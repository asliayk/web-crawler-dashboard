// crawler.go
package main

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

// pre-compile HTML4 doctype regexes once
var (
    html4Strict      = regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4\.01//en"`)
    html4Transitional = regexp.MustCompile(`<!doctype html public "-//w3c//dtd html 4\.01 transitional//en"`)
)

// Result holds all the metrics we collect from a single Crawl.
type Result struct {
    HTMLVersion   string // e.g. "HTML5", "HTML 4.01 Strict", etc.
    Title         string // <title>…</title>
    H1Count       int
    H2Count       int
    H3Count       int
    H4Count       int
    H5Count       int
    H6Count       int
    InternalLinks int    // same-domain <a> count
    ExternalLinks int    // off-domain <a> count
    BrokenLinks   int    // links with 4xx/5xx status
    HasLoginForm  bool   // true if any <form> contains <input type="password">
}

// Crawl fetches the target URL and extracts all the required metrics.
func Crawl(target string) (*Result, error) {
    // 1) HTTP GET with timeout
    client := &http.Client{Timeout: 15 * time.Second}
    resp, err := client.Get(target)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    // 2) TeeReader to capture first ~1KB for doctype
    buf := &bytes.Buffer{}
    tee := io.TeeReader(resp.Body, buf)

    // 3) Parse HTML (reads from tee and fills buf)
    doc, err := goquery.NewDocumentFromReader(tee)
    if err != nil {
        return nil, err
    }

    // 4) Detect HTML version from buf
    version := detectHTMLVersion(buf)

    // 5) Initialize result and collect basic info
    r := &Result{
        HTMLVersion: version,
        Title:       strings.TrimSpace(doc.Find("title").First().Text()),
    }
    r.H1Count = doc.Find("h1").Length()
    r.H2Count = doc.Find("h2").Length()
    r.H3Count = doc.Find("h3").Length()
    r.H4Count = doc.Find("h4").Length()
    r.H5Count = doc.Find("h5").Length()
    r.H6Count = doc.Find("h6").Length()

    // 6) Detect login form
    doc.Find("form").EachWithBreak(func(_ int, sel *goquery.Selection) bool {
        if sel.Find(`input[type="password"]`).Length() > 0 {
            r.HasLoginForm = true
            return false
        }
        return true
    })

    // 7) Collect and count links
    baseURL, err := url.Parse(target)
    if err != nil {
        return nil, err
    }
    var links []string
    doc.Find("a[href]").Each(func(_ int, sel *goquery.Selection) {
        href, _ := sel.Attr("href")
        // skip mailto: and javascript:
        if strings.HasPrefix(href, "mailto:") || strings.HasPrefix(href, "javascript:") {
            return
        }
        absolute, err := baseURL.Parse(href)
        if err != nil {
            return
        }
        links = append(links, absolute.String())
        if absolute.Hostname() == baseURL.Hostname() {
            r.InternalLinks++
        } else {
            r.ExternalLinks++
        }
    })

    // 8) Check broken links concurrently (max 10 at a time)
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

    return r, nil
}

// detectHTMLVersion inspects the first ~1KB for a <!DOCTYPE …> declaration.
func detectHTMLVersion(r io.Reader) string {
    data, _ := io.ReadAll(io.LimitReader(r, 1024))
    s := strings.ToLower(string(data))
    if strings.Contains(s, "<!doctype html>") {
        return "HTML5"
    }
    if html4Strict.MatchString(s) {
        return "HTML 4.01 Strict"
    }
    if html4Transitional.MatchString(s) {
        return "HTML 4.01 Transitional"
    }
    return "Unknown"
}

// isBroken sends a HEAD request and treats any error or 4xx/5xx as broken.
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
    return resp.StatusCode >= 400
}
