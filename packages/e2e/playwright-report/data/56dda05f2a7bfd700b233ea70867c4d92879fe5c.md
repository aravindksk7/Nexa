# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "DataGovernance" [level=5] [ref=e6]
      - paragraph [ref=e7]: Sign in to your account
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]: Email
        - generic [ref=e11]:
          - textbox "Email" [active] [ref=e12]
          - group:
            - generic: Email
        - paragraph [ref=e13]: Email is required
      - generic [ref=e14]:
        - generic: Password
        - generic [ref=e15]:
          - textbox "Password" [ref=e16]
          - button [ref=e18] [cursor=pointer]:
            - img [ref=e19]
          - group:
            - generic: Password
        - paragraph [ref=e21]: Password is required
      - button "Sign In" [ref=e22] [cursor=pointer]: Sign In
    - paragraph [ref=e24]:
      - text: Don't have an account?
      - link "Sign up" [ref=e25] [cursor=pointer]:
        - /url: /register
  - generic [ref=e26]:
    - img [ref=e28]
    - button "Open Tanstack query devtools" [ref=e76] [cursor=pointer]:
      - img [ref=e77]
  - button "Open Next.js Dev Tools" [ref=e130] [cursor=pointer]:
    - img [ref=e131]
  - alert [ref=e134]
```