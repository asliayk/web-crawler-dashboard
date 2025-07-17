package services

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// BrokenLinkDetail holds information about a single broken link found during crawling.
type BrokenLinkDetail struct {
	ID     int    `json:"id"`
	UrlID  int    `json:"url_id"`
	Link   string `json:"link"`
	Status int    `json:"status"`
}

// CrawlResult contains all extracted information from a crawled web page.
type CrawlResult struct {
	HTMLVersion   string // Detected HTML version (e.g., HTML5)
	Title         string // Page <title>
	H1Count       int    // Number of <h1> tags
	H2Count       int    // Number of <h2> tags
	H3Count       int    // Number of <h3> tags
	H4Count       int    // Number of <h4> tags
	H5Count       int    // Number of <h5> tags
	H6Count       int    // Number of <h6> tags
	InternalLinks int    // Count of internal links
	ExternalLinks int    // Count of external links
	BrokenLinks   int    // Count of broken links (4xx/5xx)
	HasLoginForm  bool   // True if a login form is detected
	BrokenLinkDetails []BrokenLinkDetail // Details of each broken link
}

var (
	reHTML4Strict       = regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4.01//en"`)
	reHTML4Transitional = regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4.01 transitional//en"`)
)

// Crawl fetches the target URL, parses the HTML, and extracts all required information.
func Crawl(target string) (*CrawlResult, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(target)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	buf := &bytes.Buffer{}
	tee := io.TeeReader(resp.Body, buf)
	doc, err := goquery.NewDocumentFromReader(tee)
	if err != nil {
		return nil, err
	}

	ver := detectHTMLVersion(buf)

	r := &CrawlResult{
		HTMLVersion: ver,
		Title:       strings.TrimSpace(doc.Find("title").First().Text()),
	}

	// Count heading tags
	r.H1Count = doc.Find("h1").Length()
	r.H2Count = doc.Find("h2").Length()
	r.H3Count = doc.Find("h3").Length()
	r.H4Count = doc.Find("h4").Length()
	r.H5Count = doc.Find("h5").Length()
	r.H6Count = doc.Find("h6").Length()

	// Detect login form by searching for password input
	doc.Find("form").EachWithBreak(func(_ int, sel *goquery.Selection) bool {
		if sel.Find(`input[type=\"password\"]`).Length() > 0 {
			r.HasLoginForm = true
			return false
		}
		return true
	})

	// Parse all links and classify as internal or external
	base, err := url.Parse(target)
	if err != nil {
		return r, nil
	}
	var links []string
	doc.Find("a[href]").Each(func(_ int, sel *goquery.Selection) {
		href, _ := sel.Attr("href")
		if strings.HasPrefix(href, "mailto:") || strings.HasPrefix(href, "javascript:") {
			return
		}
		abs, err := base.Parse(href)
		if err != nil {
			return
		}
		links = append(links, abs.String())
		if abs.Hostname() == base.Hostname() {
			r.InternalLinks++
		} else {
			r.ExternalLinks++
		}
	})

	// Check all links concurrently for broken status
	sem := make(chan struct{}, 10) // Limit concurrency
	var wg sync.WaitGroup
	brokenChan := make(chan BrokenLinkDetail, len(links))
	for _, link := range links {
		wg.Add(1)
		sem <- struct{}{}
		go func(u string) {
			defer wg.Done()
			defer func() { <-sem }()
			if status, broken := isBroken(u); broken {
				brokenChan <- BrokenLinkDetail{Link: u, Status: status}
			}
		}(link)
	}
	wg.Wait()
	close(brokenChan)
	for b := range brokenChan {
		r.BrokenLinks++
		r.BrokenLinkDetails = append(r.BrokenLinkDetails, b)
	}

	return r, nil
}

// detectHTMLVersion inspects the first 1KB of HTML to determine the doctype/version.
func detectHTMLVersion(r io.Reader) string {
	data, _ := io.ReadAll(io.LimitReader(r, 1024))
	s := strings.ToLower(string(data))
	if strings.Contains(s, "<!doctype html>") {
		return "HTML5"
	}
	if reHTML4Strict.MatchString(s) {
		return "HTML 4.01 Strict"
	}
	if reHTML4Transitional.MatchString(s) {
		return "HTML 4.01 Transitional"
	}
	return "Unknown"
}

// isBroken checks if a link returns a 4xx/5xx status code (broken).
func isBroken(link string) (int, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, link, nil)
	if err != nil {
		return 0, true
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, true
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return resp.StatusCode, true
	}
	return resp.StatusCode, false
} 