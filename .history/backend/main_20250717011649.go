package main

import (
    "database/sql"
    "log"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    _ "github.com/go-sql-driver/mysql"
)

// URL holds both the original URL and all of our crawl results.
type URL struct {
    ID            int       `json:"id"`
    URL           string    `json:"url"`
    Status        string    `json:"status"`         // queued | running | done | error
    HTMLVersion   string    `json:"html_version"`   // e.g. "HTML5"
    Title         string    `json:"title"`          // <title>…</title>
    H1Count       int       `json:"h1_count"`       // number of <h1> tags
    H2Count       int       `json:"h2_count"`
    H3Count       int       `json:"h3_count"`
    H4Count       int       `json:"h4_count"`
    H5Count       int       `json:"h5_count"`
    H6Count       int       `json:"h6_count"`
    InternalLinks int       `json:"internal_links"` // same-domain <a> count
    ExternalLinks int       `json:"external_links"` // off-domain <a> count
    BrokenLinks   int       `json:"broken_links"`   // 4xx/5xx count
    HasLoginForm  bool      `json:"has_login_form"` // true if a <form> has <input type="password">
    CreatedAt     time.Time `json:"created_at"`     // timestamp of insertion
}

func main() {
    // ─── 1) CONNECT TO DATABASE ───────────────────────────────────────────────
    dsn := "root:rootpw@tcp(mysql:3306)/crawler?parseTime=true"
    db, err := sql.Open("mysql", dsn)
    if err != nil {
        log.Fatal("Failed to connect to DB:", err)
    }
    defer db.Close()

    // ─── 2) SET UP GIN ROUTER ─────────────────────────────────────────────────
    router := gin.Default()
    api := router.Group("/api")

    // ─── CREATE A NEW URL RECORD ──────────────────────────────────────────────
    api.POST("/urls", func(c *gin.Context) {
        var req struct{ URL string `json:"url"` }
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
            return
        }
        res, err := db.Exec("INSERT INTO urls (url) VALUES (?)", req.URL)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        id, _ := res.LastInsertId()
        c.JSON(http.StatusCreated, gin.H{"id": id})
    })

    // ─── LIST ALL URLS AND THEIR STATUS/RESULTS ────────────────────────────────
    api.GET("/urls", func(c *gin.Context) {
        rows, err := db.Query(`
            SELECT id, url, status, html_version, title,
                   h1_count, h2_count, h3_count, h4_count, h5_count, h6_count,
                   internal_links, external_links, broken_links, has_login_form,
                   created_at
              FROM urls
             ORDER BY created_at DESC
        `)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        defer rows.Close()

        // Always start with an empty slice (never nil)
        list := make([]URL, 0)

        for rows.Next() {
            var u URL
            var htmlVer, title sql.NullString

            // Scan into sql.NullString for nullable text fields
            if err := rows.Scan(
                &u.ID, &u.URL, &u.Status,
                &htmlVer, &title,
                &u.H1Count, &u.H2Count, &u.H3Count,
                &u.H4Count, &u.H5Count, &u.H6Count,
                &u.InternalLinks, &u.ExternalLinks,
                &u.BrokenLinks, &u.HasLoginForm,
                &u.CreatedAt,
            ); err != nil {
                log.Println("GET /urls scan error:", err)
                continue
            }

            // Copy NullString → string (empty if NULL)
            u.HTMLVersion = htmlVer.String
            u.Title = title.String

            list = append(list, u)
        }

        c.JSON(http.StatusOK, gin.H{"urls": list})
    })

    // ─── GET DETAILS FOR A SINGLE URL ─────────────────────────────────────────
    api.GET("/urls/:id", func(c *gin.Context) {
        id := c.Param("id")
        var u URL
        var htmlVer, title sql.NullString

        err := db.QueryRow(`
            SELECT id, url, status, html_version, title,
                   h1_count, h2_count, h3_count, h4_count, h5_count, h6_count,
                   internal_links, external_links, broken_links, has_login_form,
                   created_at
              FROM urls
             WHERE id = ?
        `, id).Scan(
            &u.ID, &u.URL, &u.Status,
            &htmlVer, &title,
            &u.H1Count, &u.H2Count, &u.H3Count,
            &u.H4Count, &u.H5Count, &u.H6Count,
            &u.InternalLinks, &u.ExternalLinks,
            &u.BrokenLinks, &u.HasLoginForm,
            &u.CreatedAt,
        )
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
            return
        } else if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        u.HTMLVersion = htmlVer.String
        u.Title = title.String

        c.JSON(http.StatusOK, u)
    })

    // ─── UPDATE JUST THE URL STRING ────────────────────────────────────────────
    api.PUT("/urls/:id", func(c *gin.Context) {
        id := c.Param("id")
        var req struct{ URL string `json:"url"` }
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
            return
        }
        if _, err := db.Exec("UPDATE urls SET url = ? WHERE id = ?", req.URL, id); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.Status(http.StatusNoContent)
    })

    // ─── DELETE A URL RECORD ───────────────────────────────────────────────────
    api.DELETE("/urls/:id", func(c *gin.Context) {
        id := c.Param("id")
        if _, err := db.Exec("DELETE FROM urls WHERE id = ?", id); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.Status(http.StatusNoContent)
    })

    // ─── START A CRAWL JOB ─────────────────────────────────────────────────────
    api.PUT("/urls/:id/start", func(c *gin.Context) {
        id := c.Param("id")

        // Mark status = 'running'
        if _, err := db.Exec("UPDATE urls SET status = 'running' WHERE id = ?", id); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.Status(http.StatusNoContent)

        // Launch crawl in background
        go func(id string) {
            // Fetch URL
            var rawURL string
            if err := db.QueryRow("SELECT url FROM urls WHERE id = ?", id).Scan(&rawURL); err != nil {
                db.Exec("UPDATE urls SET status = 'error' WHERE id = ?", id)
                return
            }

            // Perform crawl (assumes Crawl is in crawler.go in same package)
            res, err := Crawl(rawURL)
            if err != nil {
                db.Exec("UPDATE urls SET status = 'error' WHERE id = ?", id)
                return
            }

            // Persist results and mark done
            _, _ = db.Exec(`
                UPDATE urls SET
                  status         = 'done',
                  html_version   = ?,
                  title          = ?,
                  h1_count       = ?,
                  h2_count       = ?,
                  h3_count       = ?,
                  h4_count       = ?,
                  h5_count       = ?,
                  h6_count       = ?,
                  internal_links = ?,
                  external_links = ?,
                  broken_links   = ?,
                  has_login_form = ?
                WHERE id = ?
            `,
                res.HTMLVersion,
                res.Title,
                res.H1Count,
                res.H2Count,
                res.H3Count,
                res.H4Count,
                res.H5Count,
                res.H6Count,
                res.InternalLinks,
                res.ExternalLinks,
                res.BrokenLinks,
                res.HasLoginForm,
                id,
            )
        }(id)
    })

    // ─── OPTIONAL: STOP A QUEUED JOB ──────────────────────────────────────────
    api.PUT("/urls/:id/stop", func(c *gin.Context) {
        id := c.Param("id")
        if _, err := db.Exec("UPDATE urls SET status = 'queued' WHERE id = ?", id); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.Status(http.StatusNoContent)
    })

    // ─── START THE SERVER ─────────────────────────────────────────────────────
    if err := router.Run(":8080"); err != nil {
        log.Fatal("Server failed:", err)
    }
}
