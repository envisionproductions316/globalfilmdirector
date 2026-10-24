# Production deployment checklist — GFD auth clients

See Envision Cloud `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` for IdP-side steps.

## GFD website

- [ ] `AUTH_ISSUER` HTTPS matches Envision discovery  
- [ ] `AUTH_CLIENT_SECRET` matches `ENVISION_GFD_WEB_CLIENT_SECRET`  
- [ ] `NEXT_PUBLIC_AUTH_REDIRECT_URI` on allowlist  
- [ ] Secure HttpOnly cookies in production  
- [ ] Smoke: register → sign-in → refresh → sign-out  

## GFD desktop

- [ ] Public client `gfd-desktop`  
- [ ] `AUTH_REQUIRE_SAFE_STORAGE=1` on Windows release  
- [ ] Packaged build against staging issuer  
- [ ] Same `sub` as web; revoke; local projects kept  

No public installer without approval.
