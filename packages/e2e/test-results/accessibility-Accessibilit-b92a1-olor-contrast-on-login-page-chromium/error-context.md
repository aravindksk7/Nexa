# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "DataGovernance" [level=5] [ref=e6]
      - paragraph [ref=e7]: Sign in to your account
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic: Email
        - generic [ref=e10]:
          - textbox "Email" [ref=e11]
          - group:
            - generic: Email
      - generic [ref=e12]:
        - generic: Password
        - generic [ref=e13]:
          - textbox "Password" [ref=e14]
          - button [ref=e16] [cursor=pointer]:
            - img [ref=e17]
          - group:
            - generic: Password
      - button "Sign In" [ref=e19] [cursor=pointer]
    - paragraph [ref=e21]:
      - text: Don't have an account?
      - link "Sign up" [ref=e22] [cursor=pointer]:
        - /url: /register
  - generic [ref=e23]:
    - img [ref=e25]
    - button "Open Tanstack query devtools" [ref=e73] [cursor=pointer]:
      - img [ref=e74]
  - button "Open Next.js Dev Tools" [ref=e127] [cursor=pointer]:
    - img [ref=e128]
  - alert [ref=e131]
```