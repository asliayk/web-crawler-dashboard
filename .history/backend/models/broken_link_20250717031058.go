package models

type BrokenLink struct {
	ID     int    `json:"id"`
	URLID  int    `json:"url_id"`
	Link   string `json:"link"`
	Status int    `json:"status"`
} 