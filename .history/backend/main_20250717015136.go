package main

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
)

// DB row -> JSON
type URL struct {
	ID            int       `json:"id"`
	URL           string    `json:"url"`
	Status        string    `json:"status"`
	HTMLVersion   string    `json:"html_version"`
	Title         string    `json:"title"`
	H1Count       int       `json:"h1_count"`
	H2Count       int       `json:"h2_count"`
	H3Count       int       `json:"h3_count"`
	H4Count       int       `json:"h4_count"`
	H5Count       int       `json:"h5_count"`
	H6Count       int       `json:"h6_count"`
	InternalLinks int       `json:"internal_links"`
	ExternalLinks int       `json:"external_links"`
	BrokenLinks   int       `json:"broken_links"`
	HasLoginForm  bool      `json:"has_login_form"`
	CreatedAt     time.Time `json:"created_at"`
}

func main() {
	// DSN sabit (env kullanmak istersen oku)
	dsn := "root:rootpw@tcp(mysql:3306)/crawler?parseTime=true"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("DB connect fail:", err)
	}
	defer db.Close()

	router := gin.Default()
	// basit CORS
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin,Content-Type,Accept,Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := router.Group("/api")

	// CREATE + otomatik crawl başlat
	api.POST("/urls", func(c *gin.Context) {
		var req struct {
			URL string `json:"url"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		res, err := db.Exec("INSERT INTO urls (url) VALUES (?)", req.URL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		c.JSON(http.StatusCreated, gin.H{"id": id})

		// background crawl
		go startCrawl(db, int(id))
	})

	// LIST
	api.GET("/urls", func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, url, status, html_version, title,
			       h1_count, h2_count, h3_count, h4_count, h5_count, h6_count,
			       internal_links, external_links, broken_links, has_login_form,
			       created_at
			  FROM urls
			 ORDER BY created_at DESC`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := make([]URL, 0)
		for rows.Next() {
			var u URL
			var htmlVer, title sql.NullString
			if err := rows.Scan(
				&u.ID, &u.URL, &u.Status,
				&htmlVer, &title,
				&u.H1Count, &u.H2Count, &u.H3Count, &u.H4Count, &u.H5Count, &u.H6Count,
				&u.InternalLinks, &u.ExternalLinks, &u.BrokenLinks, &u.HasLoginForm,
				&u.CreatedAt,
			); err != nil {
				log.Println("scan list:", err)
				continue
			}
			u.HTMLVersion = htmlVer.String
			u.Title = title.String
			list = append(list, u)
		}
		c.JSON(http.StatusOK, gin.H{"urls": list})
	})

	// DETAIL
	api.GET("/urls/:id", func(c *gin.Context) {
		id := c.Param("id")
		var u URL
		var htmlVer, title sql.NullString
		err := db.QueryRow(`
			SELECT id, url, status, html_version, title,
			       h1_count, h2_count, h3_count, h4_count, h5_count, h6_count,
			       internal_links, external_links, broken_links, has_login_form,
			       created_at
			  FROM urls WHERE id=?`, id).Scan(
			&u.ID, &u.URL, &u.Status,
			&htmlVer, &title,
			&u.H1Count, &u.H2Count, &u.H3Count, &u.H4Count, &u.H5Count, &u.H6Count,
			&u.InternalLinks, &u.ExternalLinks, &u.BrokenLinks, &u.HasLoginForm,
			&u.CreatedAt,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		u.HTMLVersion = htmlVer.String
		u.Title = title.String
		c.JSON(http.StatusOK, u)
	})

	// UPDATE url text
	api.PUT("/urls/:id", func(c *gin.Context) {
		id := c.Param("id")
		var req struct{ URL string `json:"url"` }
		if err := c.ShouldBindJSON(&req); err != nil || req.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		if _, err := db.Exec("UPDATE urls SET url=? WHERE id=?", req.URL, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})

	// DELETE
	api.DELETE("/urls/:id", func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec("DELETE FROM urls WHERE id=?", id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})

	// MANUAL START / RE-RUN
	api.PUT("/urls/:id/start", func(c *gin.Context) {
		idStr := c.Param("id")
		id, _ := strconv.Atoi(idStr)
		go startCrawl(db, id)
		c.Status(http.StatusNoContent)
	})

	// simple STOP (just reset to queued)
	api.PUT("/urls/:id/stop", func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec("UPDATE urls SET status='queued' WHERE id=?", id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})

	if err := router.Run(":8080"); err != nil {
		log.Fatal("server:", err)
	}
}

// startCrawl runs Crawl() and writes results to DB.
func startCrawl(db *sql.DB, id int) {
	if _, err := db.Exec("UPDATE urls SET status='running' WHERE id=?", id); err != nil {
		log.Println("startCrawl set running:", err)
		return
	}

	var rawURL string
	if err := db.QueryRow("SELECT url FROM urls WHERE id=?", id).Scan(&rawURL); err != nil {
		log.Println("startCrawl select url:", err)
		db.Exec("UPDATE urls SET status='error' WHERE id=?", id)
		return
	}

	res, err := Crawl(rawURL)
	if err != nil {
		log.Println("Crawl error:", err)
		db.Exec("UPDATE urls SET status='error' WHERE id=?", id)
		return
	}

	_, err = db.Exec(`
		UPDATE urls SET
			status='done',
			html_version=?,
			title=?,
			h1_count=?, h2_count=?, h3_count=?, h4_count=?, h5_count=?, h6_count=?,
			internal_links=?, external_links=?, broken_links=?, has_login_form=?
		WHERE id=?`,
		res.HTMLVersion, res.Title,
		res.H1Count, res.H2Count, res.H3Count, res.H4Count, res.H5Count, res.H6Count,
		res.InternalLinks, res.ExternalLinks, res.BrokenLinks, res.HasLoginForm,
		id,
	)
	if err != nil {
		log.Println("startCrawl update results:", err)
	}
}
