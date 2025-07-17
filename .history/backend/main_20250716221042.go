package main

import (
    "database/sql"
    "log"
    "net/http"

    "github.com/gin-gonic/gin"
    _ "github.com/go-sql-driver/mysql"
)

func main() {
    dsn := "root:rootpw@tcp(mysql:3306)/crawler"
    db, err := sql.Open("mysql", dsn)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    r := gin.Default()
    api := r.Group("/api")
    {
        api.POST("/urls", func(c *gin.Context) {
            // URL ekleme handler
            c.JSON(http.StatusCreated, gin.H{"message": "URL ekleniyor..."})
        })
        api.GET("/urls", func(c *gin.Context) {
            // Listeleme handler
            c.JSON(http.StatusOK, gin.H{"urls": []string{}})
        })
    }

    if err := r.Run(":8080"); err != nil {
        log.Fatal(err)
    }
}