# Checklist de Produção

- [ ] `.env` criado com segredos fortes.
- [ ] `APP_ENV=production`.
- [ ] `APP_DOMAIN=novoapp.seudominio.com`.
- [ ] `COOKIE_SECURE=true`.
- [ ] `CORS_ORIGINS=https://novoapp.seudominio.com`.
- [ ] DNS do subdomínio apontando para a VPS.
- [ ] Nginx principal com server block do subdomínio.
- [ ] Certificado TLS emitido no Nginx principal.
- [ ] `docker compose -f docker-compose.prod.yml ps` saudável.
- [ ] `/health` responde pelo subdomínio.
- [ ] `/api/v1/auth/register` funciona.
- [ ] Login, refresh após reload e logout validados no navegador.
- [ ] Backups do volume PostgreSQL configurados.
