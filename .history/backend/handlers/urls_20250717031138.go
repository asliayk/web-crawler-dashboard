package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"log"

	"github.com/gin-gonic/gin"
	"crawler/db"
	"crawler/services"
	"crawler/models"
)

func RegisterURLRoutes(router *gin.Engine, dbConn *sql.DB) {
	api := router.Group("/api")

	api.POST("/urls", func(c *gin.Context) {
		var req struct{ URL string `json:"url"` }
		if err := c.ShouldBindJSON(&req); err != nil || req.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		id, err := db.InsertURL(dbConn, req.URL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": id})

		// Crawl işlemini başlat ve sonucu DB'ye yaz
		go func(urlID int, url string) {
			db.UpdateStatus(dbConn, int(urlID), "running")
			res, err := services.Crawl(url)
			if err != nil {
				log.Printf("Crawl error: %v", err)
				db.UpdateStatus(dbConn, int(urlID), "error")
				return
			}
			// Sonuçları urls tablosuna yaz
			_, err = dbConn.Exec(`UPDATE urls SET status='done', html_version=?, title=?, h1_count=?, h2_count=?, h3_count=?, h4_count=?, h5_count=?, h6_count=?, internal_links=?, external_links=?, broken_links=?, has_login_form=? WHERE id=?`,
				res.HTMLVersion, res.Title, res.H1Count, res.H2Count, res.H3Count, res.H4Count, res.H5Count, res.H6Count, res.InternalLinks, res.ExternalLinks, res.BrokenLinks, res.HasLoginForm, urlID)
			if err != nil {
				log.Printf("DB update error: %v", err)
				return
			}
			// Kırık linkleri kaydet
			_ = db.DeleteBrokenLinksByURL(dbConn, int(urlID))
			var brokenLinks []models.BrokenLink
			for _, b := range res.BrokenLinkDetails {
				brokenLinks = append(brokenLinks, models.BrokenLink{URLID: int(urlID), Link: b.Link, Status: b.Status})
			}
			_ = db.InsertBrokenLinks(dbConn, int(urlID), brokenLinks)
		}(int(id), req.URL)
	})

	api.GET("/urls", func(c *gin.Context) {
		list, err := db.ListURLs(dbConn)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"urls": list})
	})

	api.GET("/urls/:id", func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		u, err := db.GetURL(dbConn, id)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, u)
	})

	api.GET("/urls/:id/broken", func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		list, err := db.ListBrokenLinks(dbConn, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"broken_links": list})
	})

	api.PUT("/urls/:id", func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var req struct{ URL string `json:"url"` }
		if err := c.ShouldBindJSON(&req); err != nil || req.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		if err := db.UpdateURL(dbConn, id, req.URL); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})

	api.DELETE("/urls/:id", func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		_ = db.DeleteBrokenLinksByURL(dbConn, id)
		if err := db.DeleteURL(dbConn, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})
} 