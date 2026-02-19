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
          - textbox "Email" [ref=e12]: admin@dataplatform.com
          - group:
            - generic: Email
      - generic [ref=e13]:
        - generic [ref=e14]: Password
        - generic [ref=e15]:
          - textbox "Password" [ref=e16]: Admin@123456
          - button [active] [ref=e18] [cursor=pointer]:
            - img [ref=e19]
          - group:
            - generic: Password
      - button "Sign In" [ref=e21] [cursor=pointer]
    - paragraph [ref=e23]:
      - text: Don't have an account?
      - link "Sign up" [ref=e24] [cursor=pointer]:
        - /url: /register
  - generic [ref=e25]:
    - img [ref=e27]
    - button "Open Tanstack query devtools" [ref=e75] [cursor=pointer]:
      - img [ref=e76]
  - button "Open Next.js Dev Tools" [ref=e129] [cursor=pointer]:
    - img [ref=e130]
  - alert [ref=e133]
```