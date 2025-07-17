package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Result topladığı tüm metrikleri buraya koyuyoruz.
type Result struct {
	HTMLVersion    string
	Title          string
	H1Count        int
	H2Count        int
	H3Count        int
	H4Count        int
	H5Count        int
	H6Count        int
	InternalLinks  int
	ExternalLinks  int
	BrokenLinks    int
	HasLoginForm   bool
}

// Crawl tek bir URL’i işleyip Result döner.
func Crawl(target string) (*Result, error) {
	// 1. HTTP GET
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(target)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 2. Body’yi hem doctype tespiti hem de goquery için bir Reader’a al
	buf := &bytes.Buffer{}
	tee := io.TeeReader(resp.Body, buf)

	// 3. HTML versiyonunu tespit et
	ver := detectHTMLVersion(buf)

	// 4. Goquery ile parse et
	doc, err := goquery.NewDocumentFromReader(tee)
	if err != nil {
		return nil, err
	}

	// 5. Başlık
	title := strings.TrimSpace(doc.Find("title").First().Text())

	// 6. Heading sayıları
	var r Result
	r.HTMLVersion = ver
	r.Title = title
	r.H1Count = doc.Find("h1").Length()
	r.H2Count = doc.Find("h2").Length()
	r.H3Count = doc.Find("h3").Length()
	r.H4Count = doc.Find("h4").Length()
	r.H5Count = doc.Find("h5").Length()
	r.H6Count = doc.Find("h6").Length()

	// 7. Login form tespiti
	doc.Find("form").EachWithBreak(func(_ int, sel *goquery.Selection) bool {
		if sel.Find(`input[type="password"]`).Length() > 0 {
			r.HasLoginForm = true
			return false // break
		}
		return true
	})

	// 8. Linkleri topla
	base, err := url.Parse(target)
	if err != nil {
		return nil, err
	}
	links := make([]string, 0)
	doc.Find("a[href]").Each(func(_ int, sel *goquery.Selection) {
		h, _ := sel.Attr("href")
		// atlanacak şeye karşı koruma
		if strings.HasPrefix(h, "mailto:") || strings.HasPrefix(h, "javascript:") {
			return
		}
		u, err := base.Parse(h)
		if err != nil {
			return
		}
		links = append(links, u.String())
		// domain kontrolü
		if u.Hostname() == base.Hostname() {
			r.InternalLinks++
		} else {
			r.ExternalLinks++
		}
	})

	// 9. Broken link kontrolü (concurrency‐limit 10)
	sem := make(chan struct{}, 10)
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, link := range links {
		wg.Add(1)
		sem <- struct{}{}
		go func(u string) {
			defer wg.Done()
			defer func() { <-sem }()
			if isBroken(u) {
				mu.Lock()
				r.BrokenLinks++
				mu.Unlock()
			}
		}(link)
	}
	wg.Wait()

	return &r, nil
}

// detectHTMLVersion ilk ~1KB içinde <!DOCTYPE ...> arar
func detectHTMLVersion(r io.Reader) string {
	data, _ := io.ReadAll(io.LimitReader(r, 1024))
	s := strings.ToLower(string(data))
	// HTML5
	if strings.Contains(s, "<!doctype html>") {
		return "HTML5"
	}
	// HTML4 Strict
	if regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4.01//en"`).MatchString(s) {
		return "HTML 4.01 Strict"
	}
	// HTML4 Transitional
	if regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4.01 transitional//en"`).MatchString(s) {
		return "HTML 4.01 Transitional"
	}
	return "Unknown"
}

// isBroken link’e HEAD isteği atar, 400+ dönerse true
func isBroken(link string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, link, nil)
	if err != nil {
		return true
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return true
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return true
	}
	return false
}
