package main

import (
    "database/sql"
    "log"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    _ "github.com/go-sql-driver/mysql"
)

type URL struct {
    ID        int       `json:"id"`
    URL       string    `json:"url"`
    CreatedAt time.Time `json:"created_at"`
}

func main() {
    // DB bağlantısı
    dsn := "root:rootpw@tcp(mysql:3306)/crawler?parseTime=true"
    db, err := sql.Open("mysql", dsn)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    r := gin.Default()
    api := r.Group("/api")

    // CREATE
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

    // READ ALL
    api.GET("/urls", func(c *gin.Context) {
        rows, err := db.Query("SELECT id, url, created_at FROM urls")
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        defer rows.Close()

        urls := make([]URL, 0)
        for rows.Next() {
            var u URL
            if err := rows.Scan(&u.ID, &u.URL, &u.CreatedAt); err != nil {
                continue
            }
            urls = append(urls, u)
        }
        c.JSON(http.StatusOK, gin.H{"urls": urls})
    })

    // READ ONE
    api.GET("/urls/:id", func(c *gin.Context) {
        id := c.Param("id")
        var u URL
        err := db.QueryRow("SELECT id, url, created_at FROM urls WHERE id = ?", id).
            Scan(&u.ID, &u.URL, &u.CreatedAt)
        if err == sql.ErrNoRows {
            c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
            return
        } else if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusOK, u)
    })

    // UPDATE
    api.PUT("/urls/:id", func(c *gin.Context) {
        id := c.Param("id")
        var req struct{ URL string `json:"url"` }
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
            return
        }
        _, err := db.Exec("UPDATE urls SET url = ? WHERE id = ?", req.URL, id)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.Status(http.StatusNoContent)
    })

    // DELETE
    api.DELETE("/urls/:id", func(c *gin.Context) {
        id := c.Param("id")
        _, err := db.Exec("DELETE FROM urls WHERE id = ?", id)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.Status(http.StatusNoContent)
    })

    // Server başlat
    if err := r.Run(":8080"); err != nil {
        log.Fatal(err)
    }
}
