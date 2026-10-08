# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: offline-recovery.spec.ts >> offline interrupted submit requires review after session close
- Location: tests/e2e/offline-recovery.spec.ts:112:3

# Error details

```
Error: page.reload: net::ERR_FAILED
Call log:
  - waiting for navigation until "load"

```

```
Error: Protocol error (Page.handleJavaScriptDialog): Not attached to an active page
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - heading "This site can’t be reached" [level=1] [ref=e7]
  - paragraph [ref=e8]:
    - text: The webpage at
    - strong [ref=e9]: http://127.0.0.1:44121/menu/table/1/review
    - text: might be temporarily down or it may have moved permanently to a new web address.
  - generic [ref=e10]: ERR_FAILED
```
