package models

import "time"

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