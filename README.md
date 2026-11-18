# Para Eduarda 💌

Site estático publicado pelo GitHub Pages (sem etapa de build).

## Estrutura

- `index.html` — página principal.
- `style.css` — visual ("noite de veludo": rubi, champanhe, vidro fosco), mobile-first.
- `script.js` — envelope, terço de São Bento, jogos, música e contador.
- `hero3d.js` — cena 3D da abertura (three.js via CDN, carregada só depois da página pronta).
- `coracao.glb` — coração + anel modelados no Blender (compressão Meshopt, ~90 KB).
- `assets/` — pôster do coração e fotos em WebP; `build_heart.blender.py` recria tudo:
  `blender -b --python assets/build_heart.blender.py`
- `foto-*.jpg` — fotos originais (fallback para navegadores sem WebP).
- `musica.mp3` — "Salvatore", carregada só ao tocar.

## Desempenho

- O 3D só renderiza enquanto a abertura está visível e não carrega em modo de economia de dados.
- Enquanto o 3D carrega, aparece um pôster estático do coração (8 KB).
- Animações respeitam "reduzir movimento" do sistema.

## Publicar

Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Extras

- `manifest.webmanifest` + `sw.js` — pode ser instalado na tela inicial e abre offline.
- `assets/og-card.jpg` — imagem de prévia ao compartilhar o link.
- Mini player flutuante enquanto a música toca; surpresa escondida ao tocar 7 vezes no coração.
