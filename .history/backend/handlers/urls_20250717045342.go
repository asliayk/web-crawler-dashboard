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

		// start crawling
		go func(urlID int, url string) {
			db.UpdateStatus(dbConn, int(urlID), "running")
			res, err := services.Crawl(url)
			if err != nil {
				log.Printf("Crawl error: %v", err)
				db.UpdateStatus(dbConn, int(urlID), "error")
				return
			}
			_, err = dbConn.Exec(`UPDATE urls SET status='done', html_version=?, title=?, h1_count=?, h2_count=?, h3_count=?, h4_count=?, h5_count=?, h6_count=?, internal_links=?, external_links=?, broken_links=?, has_login_form=? WHERE id=?`,
				res.HTMLVersion, res.Title, res.H1Count, res.H2Count, res.H3Count, res.H4Count, res.H5Count, res.H6Count, res.InternalLinks, res.ExternalLinks, res.BrokenLinks, res.HasLoginForm, urlID)
			if err != nil {
				log.Printf("DB update error: %v", err)
				return
			}
			if _, err := dbConn.Exec("DELETE FROM broken_links WHERE url_id=?", urlID); err != nil {
				log.Println("clear broken links:", err)
			}
			for _, b := range res.BrokenLinkDetails {
				_, err := dbConn.Exec(
					"INSERT INTO broken_links (url_id, link, status) VALUES (?, ?, ?)",
					urlID, b.Link, b.Status,
				)
				if err != nil {
					log.Println("insert broken link:", err)
				}
			}
		}(int(id), req.URL)
	})

	api.GET("/urls", func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
		sort := c.DefaultQuery("sort", "")
		filter := c.DefaultQuery("filter", "")
		list, err := db.ListURLsPaginated(dbConn, page, pageSize, sort, filter)
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
		id := c.Param("id")
		rows, err := dbConn.Query(`SELECT id, url_id, link, status FROM broken_links WHERE url_id=?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		var list []services.BrokenLinkDetail
		for rows.Next() {
			var b services.BrokenLinkDetail
			if err := rows.Scan(&b.ID, &b.UrlID, &b.Link, &b.Status); err != nil {
				log.Println("scan broken link:", err)
				continue
			}
			list = append(list, b)
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

	api.POST("/urls/bulk-delete", func(c *gin.Context) {
		var req struct{ IDs []int `json:"ids"` }
		if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		for _, id := range req.IDs {
			_ = db.DeleteBrokenLinksByURL(dbConn, id)
			_ = db.DeleteURL(dbConn, id)
		}
		c.Status(http.StatusNoContent)
	})

	api.POST("/urls/bulk-restart", func(c *gin.Context) {
		var req struct{ IDs []int `json:"ids"` }
		if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		for _, id := range req.IDs {
			u, err := db.GetURL(dbConn, id)
			if err != nil { continue }
			go func(urlID int, url string) {
				db.UpdateStatus(dbConn, urlID, "running")
				res, err := services.Crawl(url)
				if err != nil {
					db.UpdateStatus(dbConn, urlID, "error")
					return
				}
				_, err = dbConn.Exec(`UPDATE urls SET status='done', html_version=?, title=?, h1_count=?, h2_count=?, h3_count=?, h4_count=?, h5_count=?, h6_count=?, internal_links=?, external_links=?, broken_links=?, has_login_form=? WHERE id=?`,
					res.HTMLVersion, res.Title, res.H1Count, res.H2Count, res.H3Count, res.H4Count, res.H5Count, res.H6Count, res.InternalLinks, res.ExternalLinks, res.BrokenLinks, res.HasLoginForm, urlID)
				if err != nil { return }
				_ = db.DeleteBrokenLinksByURL(dbConn, urlID)
				var brokenLinks []models.BrokenLink
				for _, b := range res.BrokenLinkDetails {
					brokenLinks = append(brokenLinks, models.BrokenLink{URLID: urlID, Link: b.Link, Status: b.Status})
				}
				err = db.InsertBrokenLinks(dbConn, urlID, brokenLinks)
				if err != nil {
					log.Printf("InsertBrokenLinks error: %v", err)
				}
			}(id, u.URL)
		}
		c.Status(http.StatusNoContent)
	})

	api.PUT("/urls/:id/start", func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		u, err := db.GetURL(dbConn, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		go func(urlID int, url string) {
			db.UpdateStatus(dbConn, urlID, "running")
			res, err := services.Crawl(url)
			if err != nil {
				db.UpdateStatus(dbConn, urlID, "error")
				return
			}
			_, err = dbConn.Exec(`UPDATE urls SET status='done', html_version=?, title=?, h1_count=?, h2_count=?, h3_count=?, h4_count=?, h5_count=?, h6_count=?, internal_links=?, external_links=?, broken_links=?, has_login_form=? WHERE id=?`,
				res.HTMLVersion, res.Title, res.H1Count, res.H2Count, res.H3Count, res.H4Count, res.H5Count, res.H6Count, res.InternalLinks, res.ExternalLinks, res.BrokenLinks, res.HasLoginForm, urlID)
			if err != nil { return }
			if _, err := dbConn.Exec("DELETE FROM broken_links WHERE url_id=?", urlID); err != nil {
				log.Println("clear broken links:", err)
			}
			for _, b := range res.BrokenLinkDetails {
				_, err := dbConn.Exec(
					"INSERT INTO broken_links (url_id, link, status) VALUES (?, ?, ?)",
					urlID, b.Link, b.Status,
				)
				if err != nil {
					log.Println("insert broken link:", err)
				}
			}
		}(u.ID, u.URL)
		c.Status(http.StatusNoContent)
	})
} 