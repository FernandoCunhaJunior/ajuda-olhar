# Ajuda Olhar

Aplicativo web (celular e tablet) para uma pessoa responder **SIM** e **NÃO** usando apenas os olhos, pela câmera frontal. A resposta aparece grande na tela e é falada em voz alta.

## Modos de resposta

| Modo | SIM | NÃO |
|---|---|---|
| Piscada longa | 1 piscada longa | 2 piscadas longas |
| Olhar para os lados | direita | esquerda |
| Olhar para cima / baixo | cima | baixo |

Piscadas normais (curtas) são ignoradas. Em **Ajustes** dá para mudar o tempo de confirmação, a sensibilidade, qual olho é observado (útil se um lado do rosto estiver paralisado) e inverter SIM/NÃO.

## Como usar

1. Abra o endereço do app no navegador do celular/tablet (Chrome no Android, Safari no iPhone/iPad).
2. Escolha o modo, toque em **Iniciar câmera** e permita o uso da câmera.
3. Posicione o aparelho a 30–50 cm do rosto, com boa luz de frente.
4. Nos modos de olhar, peça para a pessoa olhar para a tela e toque em **Calibrar centro**.
5. Faça perguntas de sim ou não. Para decisões importantes, repita a pergunta para confirmar.

## Publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para um repositório público.
2. No repositório: **Settings → Pages → Deploy from a branch → main / (root)**.
3. O app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

A câmera só funciona em `https` (o GitHub Pages já é).

## Privacidade

O vídeo é processado no próprio aparelho (MediaPipe Face Landmarker). Nada é gravado nem enviado. Na primeira abertura o app baixa o modelo de reconhecimento do servidor do Google; depois funciona offline. Veja `models/LEIA-ME.md` para hospedar o modelo junto.

## Estrutura

- `index.html`, `css/style.css` — interface
- `js/gestures.js` — interpretação dos gestos (lógica pura)
- `js/app.js` — câmera, detecção, voz, ajustes
- `vendor/tasks-vision/` — biblioteca MediaPipe (Apache 2.0)
- `tests/` — testes da lógica: `npm test`

## Limitações

- Ainda não foi testado com a pessoa: os limites de piscada e olhar precisam ser ajustados com ela. Se os lados saírem trocados, use **Inverter SIM e NÃO**.
- Óculos com reflexo, pouca luz e pálpebra caída atrapalham a detecção.
- Não é um dispositivo médico e não substitui a avaliação de fonoaudiólogo ou terapeuta ocupacional.

## Próximos passos

Frases prontas ("dor", "sede", "virar de lado") e quadro de letras por varredura, usando o mesmo gesto.
