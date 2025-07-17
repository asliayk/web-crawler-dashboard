package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"crawler/db"
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
		// crawl başlatma burada olacak (servis katmanında)
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
		if err := db.DeleteURL(dbConn, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})
} 