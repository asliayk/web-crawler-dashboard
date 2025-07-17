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

type BrokenLinkDetail struct {
	Link   string
	Status int
}

type CrawlResult struct {
	HTMLVersion   string
	Title         string
	H1Count       int
	H2Count       int
	H3Count       int
	H4Count       int
	H5Count       int
	H6Count       int
	InternalLinks int
	ExternalLinks int
	BrokenLinks   int
	HasLoginForm  bool
	BrokenLinkDetails []BrokenLinkDetail
}

var (
	reHTML4Strict       = regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4.01//en"`)
	reHTML4Transitional = regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4.01 transitional//en"`)
)

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

	r.H1Count = doc.Find("h1").Length()
	r.H2Count = doc.Find("h2").Length()
	r.H3Count = doc.Find("h3").Length()
	r.H4Count = doc.Find("h4").Length()
	r.H5Count = doc.Find("h5").Length()
	r.H6Count = doc.Find("h6").Length()

	doc.Find("form").EachWithBreak(func(_ int, sel *goquery.Selection) bool {
		if sel.Find(`input[type=\"password\"]`).Length() > 0 {
			r.HasLoginForm = true
			return false
		}
		return true
	})

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

	sem := make(chan struct{}, 10)
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