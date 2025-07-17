package db

import (
	"database/sql"
	"crawler/models"
)

func InsertURL(db *sql.DB, url string) (int64, error) {
	res, err := db.Exec("INSERT INTO urls (url) VALUES (?)", url)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func GetURL(db *sql.DB, id int) (*models.URL, error) {
	var u models.URL
	var htmlVer, title sql.NullString
	err := db.QueryRow(`SELECT id, url, status, html_version, title,
		h1_count, h2_count, h3_count, h4_count, h5_count, h6_count,
		internal_links, external_links, broken_links, has_login_form, created_at
		FROM urls WHERE id=?`, id).Scan(
		&u.ID, &u.URL, &u.Status, &htmlVer, &title,
		&u.H1Count, &u.H2Count, &u.H3Count, &u.H4Count, &u.H5Count, &u.H6Count,
		&u.InternalLinks, &u.ExternalLinks, &u.BrokenLinks, &u.HasLoginForm, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	u.HTMLVersion = htmlVer.String
	u.Title = title.String
	return &u, nil
}

func ListURLs(db *sql.DB) ([]models.URL, error) {
	rows, err := db.Query(`SELECT id, url, status, html_version, title,
		h1_count, h2_count, h3_count, h4_count, h5_count, h6_count,
		internal_links, external_links, broken_links, has_login_form, created_at
		FROM urls ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.URL
	for rows.Next() {
		var u models.URL
		var htmlVer, title sql.NullString
		if err := rows.Scan(
			&u.ID, &u.URL, &u.Status, &htmlVer, &title,
			&u.H1Count, &u.H2Count, &u.H3Count, &u.H4Count, &u.H5Count, &u.H6Count,
			&u.InternalLinks, &u.ExternalLinks, &u.BrokenLinks, &u.HasLoginForm, &u.CreatedAt,
		); err != nil {
			continue
		}
		u.HTMLVersion = htmlVer.String
		u.Title = title.String
		list = append(list, u)
	}
	return list, nil
}

func UpdateURL(db *sql.DB, id int, url string) error {
	_, err := db.Exec("UPDATE urls SET url=? WHERE id=?", url, id)
	return err
}

func DeleteURL(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM urls WHERE id=?", id)
	return err
}

func UpdateStatus(db *sql.DB, id int, status string) error {
	_, err := db.Exec("UPDATE urls SET status=? WHERE id=?", status, id)
	return err
}

func InsertBrokenLinks(db *sql.DB, urlID int, links []models.BrokenLink) error {
	for _, l := range links {
		_, err := db.Exec("INSERT INTO broken_links (url_id, link, status) VALUES (?, ?, ?)", urlID, l.Link, l.Status)
		if err != nil {
			return err
		}
	}
	return nil
}

func ListBrokenLinks(db *sql.DB, urlID int) ([]models.BrokenLink, error) {
	rows, err := db.Query("SELECT id, url_id, link, status FROM broken_links WHERE url_id=?", urlID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.BrokenLink
	for rows.Next() {
		var b models.BrokenLink
		if err := rows.Scan(&b.ID, &b.URLID, &b.Link, &b.Status); err != nil {
			continue
		}
		list = append(list, b)
	}
	return list, nil
}

func DeleteBrokenLinksByURL(db *sql.DB, urlID int) error {
	_, err := db.Exec("DELETE FROM broken_links WHERE url_id=?", urlID)
	return err
} 