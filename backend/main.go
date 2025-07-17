package main

import (
	"database/sql"
	"log"
	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"crawler/handlers"
)

func main() {
	dsn := "root:rootpw@tcp(mysql:3306)/crawler?parseTime=true"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("DB connect fail:", err)
	}
	defer db.Close()

	router := gin.Default()
	// Set up basic CORS middleware for local frontend-backend communication
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin,Content-Type,Accept,Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	handlers.RegisterURLRoutes(router, db)

	if err := router.Run(":8080"); err != nil {
		log.Fatal("server:", err)
	}
}
