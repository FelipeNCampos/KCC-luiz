# Segurança

- Nunca commite `.env`.
- Use `SECRET_KEY` longo e aleatório em produção.
- Use `COOKIE_SECURE=true` atrás de HTTPS.
- Restrinja `CORS_ORIGINS` ao domínio real.
- O PostgreSQL não é exposto publicamente no Compose de produção.
- Containers rodam com usuário não-root quando a imagem permite.
- Senhas são armazenadas com Argon2 via Passlib.
- Erros inesperados retornam mensagem genérica.
- Headers básicos de segurança são aplicados no Nginx.

## Próxima Evolução de Refresh Token

Hoje o refresh token é rotacionado a cada refresh, mas não há persistência de `jti` no banco. Para ambientes com maior risco, crie uma tabela `refresh_tokens` com hash do token, `jti`, `expires_at`, `revoked_at` e vínculo com usuário.
