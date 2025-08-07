Directory structure:
└── musistudio-claude-code-router/
    ├── README.md
    ├── CLAUDE.md
    ├── config.example.json
    ├── docker-compose.yml
    ├── dockerfile
    ├── LICENSE
    ├── package.json
    ├── pnpm-lock.yaml
    ├── README_zh.md
    ├── tsconfig.json
    ├── .dockerignore
    ├── .npmignore
    ├── blog/
    │   ├── en/
    │   │   ├── maybe-we-can-do-more-with-the-route.md
    │   │   └── project-motivation-and-how-it-works.md
    │   └── zh/
    │       ├── 或许我们能在Router中做更多事情.md
    │       └── 项目初衷及原理.md
    └── src/
        ├── cli.ts
        ├── constants.ts
        ├── index.ts
        ├── server.ts
        ├── middleware/
        │   └── auth.ts
        └── utils/
            ├── close.ts
            ├── codeCommand.ts
            ├── index.ts
            ├── log.ts
            ├── processCheck.ts
            ├── router.ts
            └── status.ts

================================================
FILE: README.md
================================================
# Claude Code Router

[中文版](README_zh.md)

> A powerful tool to route Claude Code requests to different models and customize any request.

![](blog/images/claude-code.png)

## ✨ Features

-   **Model Routing**: Route requests to different models based on your needs (e.g., background tasks, thinking, long context).
-   **Multi-Provider Support**: Supports various model providers like OpenRouter, DeepSeek, Ollama, Gemini, Volcengine, and SiliconFlow.
-   **Request/Response Transformation**: Customize requests and responses for different providers using transformers.
-   **Dynamic Model Switching**: Switch models on-the-fly within Claude Code using the `/model` command.
-   **GitHub Actions Integration**: Trigger Claude Code tasks in your GitHub workflows.
-   **Plugin System**: Extend functionality with custom transformers.

## 🚀 Getting Started

### 1. Installation

First, ensure you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code/quickstart) installed:

```shell
npm install -g @anthropic-ai/claude-code
```

Then, install Claude Code Router:

```shell
npm install -g @musistudio/claude-code-router
```

### 2. Configuration

Create and configure your `~/.claude-code-router/config.json` file. For more details, you can refer to `config.example.json`.

The `config.json` file has several key sections:
- **`PROXY_URL`** (optional): You can set a proxy for API requests, for example: `"PROXY_URL": "http://127.0.0.1:7890"`.
- **`LOG`** (optional): You can enable logging by setting it to `true`. The log file will be located at `$HOME/.claude-code-router.log`.
- **`APIKEY`** (optional): You can set a secret key to authenticate requests. When set, clients must provide this key in the `Authorization` header (e.g., `Bearer your-secret-key`) or the `x-api-key` header. Example: `"APIKEY": "your-secret-key"`.
- **`HOST`** (optional): You can set the host address for the server. If `APIKEY` is not set, the host will be forced to `127.0.0.1` for security reasons to prevent unauthorized access. Example: `"HOST": "0.0.0.0"`.

- **`Providers`**: Used to configure different model providers.
- **`Router`**: Used to set up routing rules. `default` specifies the default model, which will be used for all requests if no other route is configured.

Here is a comprehensive example:

```json
{
  "APIKEY": "your-secret-key",
  "PROXY_URL": "http://127.0.0.1:7890",
  "LOG": true,
  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": [
        "google/gemini-2.5-pro-preview",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-3.5-sonnet"
      ],
      "transformer": { "use": ["openrouter"] }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "sk-xxx",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      "transformer": {
        "use": ["deepseek"],
        "deepseek-chat": { "use": ["tooluse"] }
      }
    },
    {
      "name": "ollama",
      "api_base_url": "http://localhost:11434/v1/chat/completions",
      "api_key": "ollama",
      "models": ["qwen2.5-coder:latest"]
    }
  ],
  "Router": {
    "default": "deepseek,deepseek-chat",
    "background": "ollama,qwen2.5-coder:latest",
    "think": "deepseek,deepseek-reasoner",
    "longContext": "openrouter,google/gemini-2.5-pro-preview"
  }
}
```


### 3. Running Claude Code with the Router

Start Claude Code using the router:

```shell
ccr code
```

#### Providers

The `Providers` array is where you define the different model providers you want to use. Each provider object requires:

-   `name`: A unique name for the provider.
-   `api_base_url`: The full API endpoint for chat completions.
-   `api_key`: Your API key for the provider.
-   `models`: A list of model names available from this provider.
-   `transformer` (optional): Specifies transformers to process requests and responses.

#### Transformers

Transformers allow you to modify the request and response payloads to ensure compatibility with different provider APIs.

-   **Global Transformer**: Apply a transformer to all models from a provider. In this example, the `openrouter` transformer is applied to all models under the `openrouter` provider.
    ```json
     {
       "name": "openrouter",
       "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
       "api_key": "sk-xxx",
       "models": [
         "google/gemini-2.5-pro-preview",
         "anthropic/claude-sonnet-4",
         "anthropic/claude-3.5-sonnet"
       ],
       "transformer": { "use": ["openrouter"] }
     }
    ```
-   **Model-Specific Transformer**: Apply a transformer to a specific model. In this example, the `deepseek` transformer is applied to all models, and an additional `tooluse` transformer is applied only to the `deepseek-chat` model.
    ```json
     {
       "name": "deepseek",
       "api_base_url": "https://api.deepseek.com/chat/completions",
       "api_key": "sk-xxx",
       "models": ["deepseek-chat", "deepseek-reasoner"],
       "transformer": {
         "use": ["deepseek"],
         "deepseek-chat": { "use": ["tooluse"] }
       }
     }
    ```

-   **Passing Options to a Transformer**: Some transformers, like `maxtoken`, accept options. To pass options, use a nested array where the first element is the transformer name and the second is an options object.
    ```json
    {
      "name": "siliconflow",
      "api_base_url": "https://api.siliconflow.cn/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": ["moonshotai/Kimi-K2-Instruct"],
      "transformer": {
        "use": [
          [
            "maxtoken",
            {
              "max_tokens": 16384
            }
          ]
        ]
      }
    }
    ```

**Available Built-in Transformers:**

-   `deepseek`: Adapts requests/responses for DeepSeek API.
-   `gemini`: Adapts requests/responses for Gemini API.
-   `openrouter`: Adapts requests/responses for OpenRouter API.
-   `groq`: Adapts requests/responses for groq API.
-   `maxtoken`: Sets a specific `max_tokens` value.
-   `tooluse`: Optimizes tool usage for certain models via `tool_choice`.
-   `gemini-cli` (experimental): Unofficial support for Gemini via Gemini CLI [gemini-cli.js](https://gist.github.com/musistudio/1c13a65f35916a7ab690649d3df8d1cd).

**Custom Transformers:**

You can also create your own transformers and load them via the `transformers` field in `config.json`.

```json
{
  "transformers": [
      {
        "path": "$HOME/.claude-code-router/plugins/gemini-cli.js",
        "options": {
          "project": "xxx"
        }
      }
  ]
}
```

#### Router

The `Router` object defines which model to use for different scenarios:

-   `default`: The default model for general tasks.
-   `background`: A model for background tasks. This can be a smaller, local model to save costs.
-   `think`: A model for reasoning-heavy tasks, like Plan Mode.
-   `longContext`: A model for handling long contexts (e.g., > 60K tokens).

You can also switch models dynamically in Claude Code with the `/model` command:
`/model provider_name,model_name`
Example: `/model openrouter,anthropic/claude-3.5-sonnet`


## 🤖 GitHub Actions

Integrate Claude Code Router into your CI/CD pipeline. After setting up [Claude Code Actions](https://docs.anthropic.com/en/docs/claude-code/github-actions), modify your `.github/workflows/claude.yaml` to use the router:

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  # ... other triggers

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      # ... other conditions
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Prepare Environment
        run: |
          curl -fsSL https://bun.sh/install | bash
          mkdir -p $HOME/.claude-code-router
          cat << 'EOF' > $HOME/.claude-code-router/config.json
          {
            "log": true,
            "OPENAI_API_KEY": "${{ secrets.OPENAI_API_KEY }}",
            "OPENAI_BASE_URL": "https://api.deepseek.com",
            "OPENAI_MODEL": "deepseek-chat"
          }
          EOF
        shell: bash

      - name: Start Claude Code Router
        run: |
          nohup ~/.bun/bin/bunx @musistudio/claude-code-router@1.0.8 start &
        shell: bash

      - name: Run Claude Code
        id: claude
        uses: anthropics/claude-code-action@beta
        env:
          ANTHROPIC_BASE_URL: http://localhost:3456
        with:
          anthropic_api_key: "any-string-is-ok"
```

This setup allows for interesting automations, like running tasks during off-peak hours to reduce API costs.

## 📝 Further Reading

-   [Project Motivation and How It Works](blog/en/project-motivation-and-how-it-works.md)
-   [Maybe We Can Do More with the Router](blog/en/maybe-we-can-do-more-with-the-route.md)

## ❤️ Support & Sponsoring

If you find this project helpful, please consider sponsoring its development. Your support is greatly appreciated!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F31GN2GM)

<table>
  <tr>
    <td><img src="/blog/images/alipay.jpg" width="200" alt="Alipay" /></td>
    <td><img src="/blog/images/wechat.jpg" width="200" alt="WeChat Pay" /></td>
  </tr>
</table>

### Our Sponsors

A huge thank you to all our sponsors for their generous support!

- @Simon Leischnig
- [@duanshuaimin](https://github.com/duanshuaimin)
- [@vrgitadmin](https://github.com/vrgitadmin)
- @*o
- [@ceilwoo](https://github.com/ceilwoo)
- @*说
- @*更
- @K*g
- @R*R
- [@bobleer](https://github.com/bobleer)
- @*苗
- @*划
- [@Clarence-pan](https://github.com/Clarence-pan)
- [@carter003](https://github.com/carter003)
- @S*r
- @*晖
- @*敏
- @Z*z
- @*然
- [@cluic](https://github.com/cluic)
- @*苗
- [@PromptExpert](https://github.com/PromptExpert)
- @*应
- [@yusnake](https://github.com/yusnake)
- @*飞
- @董*
- *汀
- *涯
- *:-）

(If your name is masked, please contact me via my homepage email to update it with your GitHub username.)



================================================
FILE: CLAUDE.md
================================================
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.You need use English to write text.

## Key Development Commands
- Build: `npm run build`
- Start: `npm start`

## Architecture
- Uses `express` for routing (see `src/server.ts`)
- Bundles with `esbuild` for CLI distribution
- Plugins are loaded from `$HOME/.claude-code-router/plugins`


================================================
FILE: config.example.json
================================================
{
  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": [
        "google/gemini-2.5-pro-preview",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3.7-sonnet:thinking"
      ],
      "transformer": {
        "use": ["openrouter"]
      }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "sk-xxx",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      "transformer": {
        "use": ["deepseek"],
        "deepseek-chat": {
          "use": ["tooluse"]
        }
      }
    },
    {
      "name": "ollama",
      "api_base_url": "http://localhost:11434/v1/chat/completions",
      "api_key": "ollama",
      "models": ["qwen2.5-coder:latest"]
    },
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "sk-xxx",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "transformer": {
        "use": ["gemini"]
      }
    },
    {
      "name": "volcengine",
      "api_base_url": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      "api_key": "sk-xxx",
      "models": ["deepseek-v3-250324", "deepseek-r1-250528"],
      "transformer": {
        "use": ["deepseek"]
      }
    },
    {
      "name": "siliconflow",
      "api_base_url": "https://api.siliconflow.cn/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": ["moonshotai/Kimi-K2-Instruct"],
      "transformer": {
        "use": [
          [
            "maxtoken",
            {
              "max_tokens": 16384
            }
          ]
        ]
      }
    }
  ],
  "Router": {
    "default": "deepseek,deepseek-chat",
    "background": "ollama,qwen2.5-coder:latest",
    "think": "deepseek,deepseek-reasoner",
    "longContext": "openrouter,google/gemini-2.5-pro-preview"
  },
  "APIKEY": "your-secret-key",
  "HOST": "0.0.0.0"
}



================================================
FILE: docker-compose.yml
================================================
version: "3.8"

services:
  claude-code-reverse:
    build: .
    ports:
      - "3456:3456"
    environment:
      - ENABLE_ROUTER=${ENABLE_ROUTER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL}
      - OPENAI_MODEL=${OPENAI_MODEL}
    restart: unless-stopped



================================================
FILE: dockerfile
================================================
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm i

COPY . .

EXPOSE 3456

CMD ["node", "index.mjs"]



================================================
FILE: LICENSE
================================================
MIT License

Copyright (c) 2025 musistudio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



================================================
FILE: package.json
================================================
{
  "name": "@musistudio/claude-code-router",
  "version": "1.0.21",
  "description": "Use Claude Code without an Anthropics account and route it to another LLM provider",
  "bin": {
    "ccr": "./dist/cli.js"
  },
  "scripts": {
    "build": "esbuild src/cli.ts --bundle --platform=node --outfile=dist/cli.js && shx cp node_modules/tiktoken/tiktoken_bg.wasm dist/tiktoken_bg.wasm"
  },
  "keywords": [
    "claude",
    "code",
    "router",
    "llm",
    "anthropic"
  ],
  "author": "musistudio",
  "license": "MIT",
  "dependencies": {
    "@musistudio/llms": "^1.0.8",
    "dotenv": "^16.4.7",
    "tiktoken": "^1.0.21",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "esbuild": "^0.25.1",
    "fastify": "^5.4.0",
    "shx": "^0.4.0",
    "typescript": "^5.8.2"
  },
  "publishConfig": {
    "ignore": [
      "!build/",
      "src/",
      "screenshots/"
    ]
  }
}



================================================
FILE: pnpm-lock.yaml
================================================
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      '@musistudio/llms':
        specifier: ^1.0.8
        version: 1.0.8(ws@8.18.3)(zod@3.25.67)
      dotenv:
        specifier: ^16.4.7
        version: 16.6.1
      tiktoken:
        specifier: ^1.0.21
        version: 1.0.21
      uuid:
        specifier: ^11.1.0
        version: 11.1.0
    devDependencies:
      esbuild:
        specifier: ^0.25.1
        version: 0.25.5
      fastify:
        specifier: ^5.4.0
        version: 5.4.0
      shx:
        specifier: ^0.4.0
        version: 0.4.0
      typescript:
        specifier: ^5.8.2
        version: 5.8.3

packages:

  '@anthropic-ai/sdk@0.54.0':
    resolution: {integrity: sha512-xyoCtHJnt/qg5GG6IgK+UJEndz8h8ljzt/caKXmq3LfBF81nC/BW6E4x2rOWCZcvsLyVW+e8U5mtIr6UCE/kJw==}
    hasBin: true

  '@esbuild/aix-ppc64@0.25.5':
    resolution: {integrity: sha512-9o3TMmpmftaCMepOdA5k/yDw8SfInyzWWTjYTFCX3kPSDJMROQTb8jg+h9Cnwnmm1vOzvxN7gIfB5V2ewpjtGA==}
    engines: {node: '>=18'}
    cpu: [ppc64]
    os: [aix]

  '@esbuild/android-arm64@0.25.5':
    resolution: {integrity: sha512-VGzGhj4lJO+TVGV1v8ntCZWJktV7SGCs3Pn1GRWI1SBFtRALoomm8k5E9Pmwg3HOAal2VDc2F9+PM/rEY6oIDg==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [android]

  '@esbuild/android-arm@0.25.5':
    resolution: {integrity: sha512-AdJKSPeEHgi7/ZhuIPtcQKr5RQdo6OO2IL87JkianiMYMPbCtot9fxPbrMiBADOWWm3T2si9stAiVsGbTQFkbA==}
    engines: {node: '>=18'}
    cpu: [arm]
    os: [android]

  '@esbuild/android-x64@0.25.5':
    resolution: {integrity: sha512-D2GyJT1kjvO//drbRT3Hib9XPwQeWd9vZoBJn+bu/lVsOZ13cqNdDeqIF/xQ5/VmWvMduP6AmXvylO/PIc2isw==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [android]

  '@esbuild/darwin-arm64@0.25.5':
    resolution: {integrity: sha512-GtaBgammVvdF7aPIgH2jxMDdivezgFu6iKpmT+48+F8Hhg5J/sfnDieg0aeG/jfSvkYQU2/pceFPDKlqZzwnfQ==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [darwin]

  '@esbuild/darwin-x64@0.25.5':
    resolution: {integrity: sha512-1iT4FVL0dJ76/q1wd7XDsXrSW+oLoquptvh4CLR4kITDtqi2e/xwXwdCVH8hVHU43wgJdsq7Gxuzcs6Iq/7bxQ==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [darwin]

  '@esbuild/freebsd-arm64@0.25.5':
    resolution: {integrity: sha512-nk4tGP3JThz4La38Uy/gzyXtpkPW8zSAmoUhK9xKKXdBCzKODMc2adkB2+8om9BDYugz+uGV7sLmpTYzvmz6Sw==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [freebsd]

  '@esbuild/freebsd-x64@0.25.5':
    resolution: {integrity: sha512-PrikaNjiXdR2laW6OIjlbeuCPrPaAl0IwPIaRv+SMV8CiM8i2LqVUHFC1+8eORgWyY7yhQY+2U2fA55mBzReaw==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [freebsd]

  '@esbuild/linux-arm64@0.25.5':
    resolution: {integrity: sha512-Z9kfb1v6ZlGbWj8EJk9T6czVEjjq2ntSYLY2cw6pAZl4oKtfgQuS4HOq41M/BcoLPzrUbNd+R4BXFyH//nHxVg==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [linux]

  '@esbuild/linux-arm@0.25.5':
    resolution: {integrity: sha512-cPzojwW2okgh7ZlRpcBEtsX7WBuqbLrNXqLU89GxWbNt6uIg78ET82qifUy3W6OVww6ZWobWub5oqZOVtwolfw==}
    engines: {node: '>=18'}
    cpu: [arm]
    os: [linux]

  '@esbuild/linux-ia32@0.25.5':
    resolution: {integrity: sha512-sQ7l00M8bSv36GLV95BVAdhJ2QsIbCuCjh/uYrWiMQSUuV+LpXwIqhgJDcvMTj+VsQmqAHL2yYaasENvJ7CDKA==}
    engines: {node: '>=18'}
    cpu: [ia32]
    os: [linux]

  '@esbuild/linux-loong64@0.25.5':
    resolution: {integrity: sha512-0ur7ae16hDUC4OL5iEnDb0tZHDxYmuQyhKhsPBV8f99f6Z9KQM02g33f93rNH5A30agMS46u2HP6qTdEt6Q1kg==}
    engines: {node: '>=18'}
    cpu: [loong64]
    os: [linux]

  '@esbuild/linux-mips64el@0.25.5':
    resolution: {integrity: sha512-kB/66P1OsHO5zLz0i6X0RxlQ+3cu0mkxS3TKFvkb5lin6uwZ/ttOkP3Z8lfR9mJOBk14ZwZ9182SIIWFGNmqmg==}
    engines: {node: '>=18'}
    cpu: [mips64el]
    os: [linux]

  '@esbuild/linux-ppc64@0.25.5':
    resolution: {integrity: sha512-UZCmJ7r9X2fe2D6jBmkLBMQetXPXIsZjQJCjgwpVDz+YMcS6oFR27alkgGv3Oqkv07bxdvw7fyB71/olceJhkQ==}
    engines: {node: '>=18'}
    cpu: [ppc64]
    os: [linux]

  '@esbuild/linux-riscv64@0.25.5':
    resolution: {integrity: sha512-kTxwu4mLyeOlsVIFPfQo+fQJAV9mh24xL+y+Bm6ej067sYANjyEw1dNHmvoqxJUCMnkBdKpvOn0Ahql6+4VyeA==}
    engines: {node: '>=18'}
    cpu: [riscv64]
    os: [linux]

  '@esbuild/linux-s390x@0.25.5':
    resolution: {integrity: sha512-K2dSKTKfmdh78uJ3NcWFiqyRrimfdinS5ErLSn3vluHNeHVnBAFWC8a4X5N+7FgVE1EjXS1QDZbpqZBjfrqMTQ==}
    engines: {node: '>=18'}
    cpu: [s390x]
    os: [linux]

  '@esbuild/linux-x64@0.25.5':
    resolution: {integrity: sha512-uhj8N2obKTE6pSZ+aMUbqq+1nXxNjZIIjCjGLfsWvVpy7gKCOL6rsY1MhRh9zLtUtAI7vpgLMK6DxjO8Qm9lJw==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [linux]

  '@esbuild/netbsd-arm64@0.25.5':
    resolution: {integrity: sha512-pwHtMP9viAy1oHPvgxtOv+OkduK5ugofNTVDilIzBLpoWAM16r7b/mxBvfpuQDpRQFMfuVr5aLcn4yveGvBZvw==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [netbsd]

  '@esbuild/netbsd-x64@0.25.5':
    resolution: {integrity: sha512-WOb5fKrvVTRMfWFNCroYWWklbnXH0Q5rZppjq0vQIdlsQKuw6mdSihwSo4RV/YdQ5UCKKvBy7/0ZZYLBZKIbwQ==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [netbsd]

  '@esbuild/openbsd-arm64@0.25.5':
    resolution: {integrity: sha512-7A208+uQKgTxHd0G0uqZO8UjK2R0DDb4fDmERtARjSHWxqMTye4Erz4zZafx7Di9Cv+lNHYuncAkiGFySoD+Mw==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [openbsd]

  '@esbuild/openbsd-x64@0.25.5':
    resolution: {integrity: sha512-G4hE405ErTWraiZ8UiSoesH8DaCsMm0Cay4fsFWOOUcz8b8rC6uCvnagr+gnioEjWn0wC+o1/TAHt+It+MpIMg==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [openbsd]

  '@esbuild/sunos-x64@0.25.5':
    resolution: {integrity: sha512-l+azKShMy7FxzY0Rj4RCt5VD/q8mG/e+mDivgspo+yL8zW7qEwctQ6YqKX34DTEleFAvCIUviCFX1SDZRSyMQA==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [sunos]

  '@esbuild/win32-arm64@0.25.5':
    resolution: {integrity: sha512-O2S7SNZzdcFG7eFKgvwUEZ2VG9D/sn/eIiz8XRZ1Q/DO5a3s76Xv0mdBzVM5j5R639lXQmPmSo0iRpHqUUrsxw==}
    engines: {node: '>=18'}
    cpu: [arm64]
    os: [win32]

  '@esbuild/win32-ia32@0.25.5':
    resolution: {integrity: sha512-onOJ02pqs9h1iMJ1PQphR+VZv8qBMQ77Klcsqv9CNW2w6yLqoURLcgERAIurY6QE63bbLuqgP9ATqajFLK5AMQ==}
    engines: {node: '>=18'}
    cpu: [ia32]
    os: [win32]

  '@esbuild/win32-x64@0.25.5':
    resolution: {integrity: sha512-TXv6YnJ8ZMVdX+SXWVBo/0p8LTcrUYngpWjvm91TMjjBQii7Oz11Lw5lbDV5Y0TzuhSJHwiH4hEtC1I42mMS0g==}
    engines: {node: '>=18'}
    cpu: [x64]
    os: [win32]

  '@fastify/ajv-compiler@4.0.2':
    resolution: {integrity: sha512-Rkiu/8wIjpsf46Rr+Fitd3HRP+VsxUFDDeag0hs9L0ksfnwx2g7SPQQTFL0E8Qv+rfXzQOxBJnjUB9ITUDjfWQ==}

  '@fastify/cors@11.0.1':
    resolution: {integrity: sha512-dmZaE7M1f4SM8ZZuk5RhSsDJ+ezTgI7v3HHRj8Ow9CneczsPLZV6+2j2uwdaSLn8zhTv6QV0F4ZRcqdalGx1pQ==}

  '@fastify/error@4.2.0':
    resolution: {integrity: sha512-RSo3sVDXfHskiBZKBPRgnQTtIqpi/7zhJOEmAxCiBcM7d0uwdGdxLlsCaLzGs8v8NnxIRlfG0N51p5yFaOentQ==}

  '@fastify/fast-json-stringify-compiler@5.0.3':
    resolution: {integrity: sha512-uik7yYHkLr6fxd8hJSZ8c+xF4WafPK+XzneQDPU+D10r5X19GW8lJcom2YijX2+qtFF1ENJlHXKFM9ouXNJYgQ==}

  '@fastify/forwarded@3.0.0':
    resolution: {integrity: sha512-kJExsp4JCms7ipzg7SJ3y8DwmePaELHxKYtg+tZow+k0znUTf3cb+npgyqm8+ATZOdmfgfydIebPDWM172wfyA==}

  '@fastify/merge-json-schemas@0.2.1':
    resolution: {integrity: sha512-OA3KGBCy6KtIvLf8DINC5880o5iBlDX4SxzLQS8HorJAbqluzLRn80UXU0bxZn7UOFhFgpRJDasfwn9nG4FG4A==}

  '@fastify/proxy-addr@5.0.0':
    resolution: {integrity: sha512-37qVVA1qZ5sgH7KpHkkC4z9SK6StIsIcOmpjvMPXNb3vx2GQxhZocogVYbr2PbbeLCQxYIPDok307xEvRZOzGA==}

  '@google/genai@1.8.0':
    resolution: {integrity: sha512-n3KiMFesQCy2R9iSdBIuJ0JWYQ1HZBJJkmt4PPZMGZKvlgHhBAGw1kUMyX+vsAIzprN3lK45DI755lm70wPOOg==}
    engines: {node: '>=20.0.0'}
    peerDependencies:
      '@modelcontextprotocol/sdk': ^1.11.0
    peerDependenciesMeta:
      '@modelcontextprotocol/sdk':
        optional: true

  '@musistudio/llms@1.0.8':
    resolution: {integrity: sha512-C2GFoiw/DEo2faAQerRVOyWEupTJpoV+3z3rE9XEN31ySOcsaVPnKyWPmKKg9EDMBw70gQg5FZFg3jZxSCnWlA==}

  '@nodelib/fs.scandir@2.1.5':
    resolution: {integrity: sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==}
    engines: {node: '>= 8'}

  '@nodelib/fs.stat@2.0.5':
    resolution: {integrity: sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==}
    engines: {node: '>= 8'}

  '@nodelib/fs.walk@1.2.8':
    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
    engines: {node: '>= 8'}

  abstract-logging@2.0.1:
    resolution: {integrity: sha512-2BjRTZxTPvheOvGbBslFSYOUkr+SjPtOnrLP33f+VIWLzezQpZcqVg7ja3L4dBXmzzgwT+a029jRx5PCi3JuiA==}

  agent-base@7.1.3:
    resolution: {integrity: sha512-jRR5wdylq8CkOe6hei19GGZnxM6rBGwFl3Bg0YItGDimvjGtAvdZk4Pu6Cl4u4Igsws4a1fd1Vq3ezrhn4KmFw==}
    engines: {node: '>= 14'}

  ajv-formats@3.0.1:
    resolution: {integrity: sha512-8iUql50EUR+uUcdRQ3HDqa6EVyo3docL8g5WJ3FNcWmu62IbkGUue/pEyLBW8VGKKucTPgqeks4fIU1DA4yowQ==}
    peerDependencies:
      ajv: ^8.0.0
    peerDependenciesMeta:
      ajv:
        optional: true

  ajv@8.17.1:
    resolution: {integrity: sha512-B/gBuNg5SiMTrPkC+A2+cW0RszwxYmn6VYxB/inlBStS5nx6xHIt/ehKRhIMhqusl7a8LjQoZnjCs5vhwxOQ1g==}

  atomic-sleep@1.0.0:
    resolution: {integrity: sha512-kNOjDqAh7px0XWNI+4QbzoiR/nTkHAWNud2uvnJquD1/x5a7EQZMJT0AczqK0Qn67oY/TTQ1LbUKajZpp3I9tQ==}
    engines: {node: '>=8.0.0'}

  avvio@9.1.0:
    resolution: {integrity: sha512-fYASnYi600CsH/j9EQov7lECAniYiBFiiAtBNuZYLA2leLe9qOvZzqYHFjtIj6gD2VMoMLP14834LFWvr4IfDw==}

  base64-js@1.5.1:
    resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}

  bignumber.js@9.3.0:
    resolution: {integrity: sha512-EM7aMFTXbptt/wZdMlBv2t8IViwQL+h6SLHosp8Yf0dqJMTnY6iL32opnAB6kAdL0SZPuvcAzFr31o0c/R3/RA==}

  braces@3.0.3:
    resolution: {integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==}
    engines: {node: '>=8'}

  buffer-equal-constant-time@1.0.1:
    resolution: {integrity: sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==}

  cookie@1.0.2:
    resolution: {integrity: sha512-9Kr/j4O16ISv8zBBhJoi4bXOYNTkFLOqSL3UDB0njXxCXNezjeyVrJyGOWtgfs/q2km1gwBcfH8q1yEGoMYunA==}
    engines: {node: '>=18'}

  cross-spawn@6.0.6:
    resolution: {integrity: sha512-VqCUuhcd1iB+dsv8gxPttb5iZh/D0iubSP21g36KXdEuf6I5JiioesUVjpCdHV9MZRUfVFlvwtIUyPfxo5trtw==}
    engines: {node: '>=4.8'}

  debug@4.4.1:
    resolution: {integrity: sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==}
    engines: {node: '>=6.0'}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true

  dequal@2.0.3:
    resolution: {integrity: sha512-0je+qPKHEMohvfRTCEo3CrPG6cAzAYgmzKyxRiYSSDkS6eGJdyVJm7WaYA5ECaAD9wLB2T4EEeymA5aFVcYXCA==}
    engines: {node: '>=6'}

  dotenv@16.6.1:
    resolution: {integrity: sha512-uBq4egWHTcTt33a72vpSG0z3HnPuIl6NqYcTrKEg2azoEyl2hpW0zqlxysq2pK9HlDIHyHyakeYaYnSAwd8bow==}
    engines: {node: '>=12'}

  ecdsa-sig-formatter@1.0.11:
    resolution: {integrity: sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==}

  end-of-stream@1.4.5:
    resolution: {integrity: sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==}

  esbuild@0.25.5:
    resolution: {integrity: sha512-P8OtKZRv/5J5hhz0cUAdu/cLuPIKXpQl1R9pZtvmHWQvrAUVd0UNIPT4IB4W3rNOqVO0rlqHmCIbSwxh/c9yUQ==}
    engines: {node: '>=18'}
    hasBin: true

  execa@1.0.0:
    resolution: {integrity: sha512-adbxcyWV46qiHyvSp50TKt05tB4tK3HcmF7/nxfAdhnox83seTDbwnaqKO4sXRy7roHAIFqJP/Rw/AuEbX61LA==}
    engines: {node: '>=6'}

  extend@3.0.2:
    resolution: {integrity: sha512-fjquC59cD7CyW6urNXK0FBufkZcoiGG80wTuPujX590cB5Ttln20E2UB4S/WARVqhXffZl2LNgS+gQdPIIim/g==}

  fast-decode-uri-component@1.0.1:
    resolution: {integrity: sha512-WKgKWg5eUxvRZGwW8FvfbaH7AXSh2cL+3j5fMGzUMCxWBJ3dV3a7Wz8y2f/uQ0e3B6WmodD3oS54jTQ9HVTIIg==}

  fast-deep-equal@3.1.3:
    resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}

  fast-glob@3.3.3:
    resolution: {integrity: sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==}
    engines: {node: '>=8.6.0'}

  fast-json-stringify@6.0.1:
    resolution: {integrity: sha512-s7SJE83QKBZwg54dIbD5rCtzOBVD43V1ReWXXYqBgwCwHLYAAT0RQc/FmrQglXqWPpz6omtryJQOau5jI4Nrvg==}

  fast-querystring@1.1.2:
    resolution: {integrity: sha512-g6KuKWmFXc0fID8WWH0jit4g0AGBoJhCkJMb1RmbsSEUNvQ+ZC8D6CUZ+GtF8nMzSPXnhiePyyqqipzNNEnHjg==}

  fast-redact@3.5.0:
    resolution: {integrity: sha512-dwsoQlS7h9hMeYUq1W++23NDcBLV4KqONnITDV9DjfS3q1SgDGVrBdvvTLUotWtPSD7asWDV9/CmsZPy8Hf70A==}
    engines: {node: '>=6'}

  fast-uri@3.0.6:
    resolution: {integrity: sha512-Atfo14OibSv5wAp4VWNsFYE1AchQRTv9cBGWET4pZWHzYshFSS9NQI6I57rdKn9croWVMbYFbLhJ+yJvmZIIHw==}

  fastify-plugin@5.0.1:
    resolution: {integrity: sha512-HCxs+YnRaWzCl+cWRYFnHmeRFyR5GVnJTAaCJQiYzQSDwK9MgJdyAsuL3nh0EWRCYMgQ5MeziymvmAhUHYHDUQ==}

  fastify@5.4.0:
    resolution: {integrity: sha512-I4dVlUe+WNQAhKSyv15w+dwUh2EPiEl4X2lGYMmNSgF83WzTMAPKGdWEv5tPsCQOb+SOZwz8Vlta2vF+OeDgRw==}

  fastq@1.19.1:
    resolution: {integrity: sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==}

  fill-range@7.1.1:
    resolution: {integrity: sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==}
    engines: {node: '>=8'}

  find-my-way@9.3.0:
    resolution: {integrity: sha512-eRoFWQw+Yv2tuYlK2pjFS2jGXSxSppAs3hSQjfxVKxM5amECzIgYYc1FEI8ZmhSh/Ig+FrKEz43NLRKJjYCZVg==}
    engines: {node: '>=20'}

  function-bind@1.1.2:
    resolution: {integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==}

  gaxios@6.7.1:
    resolution: {integrity: sha512-LDODD4TMYx7XXdpwxAVRAIAuB0bzv0s+ywFonY46k126qzQHT9ygyoa9tncmOiQmmDrik65UYsEkv3lbfqQ3yQ==}
    engines: {node: '>=14'}

  gcp-metadata@6.1.1:
    resolution: {integrity: sha512-a4tiq7E0/5fTjxPAaH4jpjkSv/uCaU2p5KC6HVGrvl0cDjA8iBZv4vv1gyzlmK0ZUKqwpOyQMKzZQe3lTit77A==}
    engines: {node: '>=14'}

  get-stream@4.1.0:
    resolution: {integrity: sha512-GMat4EJ5161kIy2HevLlr4luNjBgvmj413KaQA7jt4V8B4RDsfpHk7WQ9GVqfYyyx8OS/L66Kox+rJRNklLK7w==}
    engines: {node: '>=6'}

  glob-parent@5.1.2:
    resolution: {integrity: sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==}
    engines: {node: '>= 6'}

  google-auth-library@9.15.1:
    resolution: {integrity: sha512-Jb6Z0+nvECVz+2lzSMt9u98UsoakXxA2HGHMCxh+so3n90XgYWkq5dur19JAJV7ONiJY22yBTyJB1TSkvPq9Ng==}
    engines: {node: '>=14'}

  google-logging-utils@0.0.2:
    resolution: {integrity: sha512-NEgUnEcBiP5HrPzufUkBzJOD/Sxsco3rLNo1F1TNf7ieU8ryUzBhqba8r756CjLX7rn3fHl6iLEwPYuqpoKgQQ==}
    engines: {node: '>=14'}

  gtoken@7.1.0:
    resolution: {integrity: sha512-pCcEwRi+TKpMlxAQObHDQ56KawURgyAf6jtIY046fJ5tIv3zDe/LEIubckAO8fj6JnAxLdmWkUfNyulQ2iKdEw==}
    engines: {node: '>=14.0.0'}

  hasown@2.0.2:
    resolution: {integrity: sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==}
    engines: {node: '>= 0.4'}

  https-proxy-agent@7.0.6:
    resolution: {integrity: sha512-vK9P5/iUfdl95AI+JVyUuIcVtd4ofvtrOr3HNtM2yxC9bnMbEdp3x01OhQNnjb8IJYi38VlTE3mBXwcfvywuSw==}
    engines: {node: '>= 14'}

  interpret@1.4.0:
    resolution: {integrity: sha512-agE4QfB2Lkp9uICn7BAqoscw4SZP9kTE2hxiFI3jBPmXJfdqiahTbUuKGsMoN2GtqL9AxhYioAcVvgsb1HvRbA==}
    engines: {node: '>= 0.10'}

  ipaddr.js@2.2.0:
    resolution: {integrity: sha512-Ag3wB2o37wslZS19hZqorUnrnzSkpOVy+IiiDEiTqNubEYpYuHWIf6K4psgN2ZWKExS4xhVCrRVfb/wfW8fWJA==}
    engines: {node: '>= 10'}

  is-core-module@2.16.1:
    resolution: {integrity: sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==}
    engines: {node: '>= 0.4'}

  is-extglob@2.1.1:
    resolution: {integrity: sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==}
    engines: {node: '>=0.10.0'}

  is-glob@4.0.3:
    resolution: {integrity: sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==}
    engines: {node: '>=0.10.0'}

  is-number@7.0.0:
    resolution: {integrity: sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==}
    engines: {node: '>=0.12.0'}

  is-stream@1.1.0:
    resolution: {integrity: sha512-uQPm8kcs47jx38atAcWTVxyltQYoPT68y9aWYdV6yWXSyW8mzSat0TL6CiWdZeCdF3KrAvpVtnHbTv4RN+rqdQ==}
    engines: {node: '>=0.10.0'}

  is-stream@2.0.1:
    resolution: {integrity: sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg==}
    engines: {node: '>=8'}

  isexe@2.0.0:
    resolution: {integrity: sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==}

  json-bigint@1.0.0:
    resolution: {integrity: sha512-SiPv/8VpZuWbvLSMtTDU8hEfrZWg/mH/nV/b4o0CYbSxu1UIQPLdwKOCIyLQX+VIPO5vrLX3i8qtqFyhdPSUSQ==}

  json-schema-ref-resolver@2.0.1:
    resolution: {integrity: sha512-HG0SIB9X4J8bwbxCbnd5FfPEbcXAJYTi1pBJeP/QPON+w8ovSME8iRG+ElHNxZNX2Qh6eYn1GdzJFS4cDFfx0Q==}

  json-schema-traverse@1.0.0:
    resolution: {integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==}

  jwa@2.0.1:
    resolution: {integrity: sha512-hRF04fqJIP8Abbkq5NKGN0Bbr3JxlQ+qhZufXVr0DvujKy93ZCbXZMHDL4EOtodSbCWxOqR8MS1tXA5hwqCXDg==}

  jws@4.0.0:
    resolution: {integrity: sha512-KDncfTmOZoOMTFG4mBlG0qUIOlc03fmzH+ru6RgYVZhPkyiy/92Owlt/8UEN+a4TXR1FQetfIpJE8ApdvdVxTg==}

  light-my-request@6.6.0:
    resolution: {integrity: sha512-CHYbu8RtboSIoVsHZ6Ye4cj4Aw/yg2oAFimlF7mNvfDV192LR7nDiKtSIfCuLT7KokPSTn/9kfVLm5OGN0A28A==}

  merge2@1.4.1:
    resolution: {integrity: sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==}
    engines: {node: '>= 8'}

  micromatch@4.0.8:
    resolution: {integrity: sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==}
    engines: {node: '>=8.6'}

  minimist@1.2.8:
    resolution: {integrity: sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==}

  ms@2.1.3:
    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}

  nice-try@1.0.5:
    resolution: {integrity: sha512-1nh45deeb5olNY7eX82BkPO7SSxR5SSYJiPTrTdFUVYwAl8CKMA5N9PjTYkHiRjisVcxcQ1HXdLhx2qxxJzLNQ==}

  node-fetch@2.7.0:
    resolution: {integrity: sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==}
    engines: {node: 4.x || >=6.0.0}
    peerDependencies:
      encoding: ^0.1.0
    peerDependenciesMeta:
      encoding:
        optional: true

  npm-run-path@2.0.2:
    resolution: {integrity: sha512-lJxZYlT4DW/bRUtFh1MQIWqmLwQfAxnqWG4HhEdjMlkrJYnJn0Jrr2u3mgxqaWsdiBc76TYkTG/mhrnYTuzfHw==}
    engines: {node: '>=4'}

  on-exit-leak-free@2.1.2:
    resolution: {integrity: sha512-0eJJY6hXLGf1udHwfNftBqH+g73EU4B504nZeKpz1sYRKafAghwxEJunB2O7rDZkL4PGfsMVnTXZ2EjibbqcsA==}
    engines: {node: '>=14.0.0'}

  once@1.4.0:
    resolution: {integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==}

  openai@5.8.2:
    resolution: {integrity: sha512-8C+nzoHYgyYOXhHGN6r0fcb4SznuEn1R7YZMvlqDbnCuE0FM2mm3T1HiYW6WIcMS/F1Of2up/cSPjLPaWt0X9Q==}
    hasBin: true
    peerDependencies:
      ws: ^8.18.0
      zod: ^3.23.8
    peerDependenciesMeta:
      ws:
        optional: true
      zod:
        optional: true

  p-finally@1.0.0:
    resolution: {integrity: sha512-LICb2p9CB7FS+0eR1oqWnHhp0FljGLZCWBE9aix0Uye9W8LTQPwMTYVGWQWIw9RdQiDg4+epXQODwIYJtSJaow==}
    engines: {node: '>=4'}

  path-key@2.0.1:
    resolution: {integrity: sha512-fEHGKCSmUSDPv4uoj8AlD+joPlq3peND+HRYyxFz4KPw4z926S/b8rIuFs2FYJg3BwsxJf6A9/3eIdLaYC+9Dw==}
    engines: {node: '>=4'}

  path-parse@1.0.7:
    resolution: {integrity: sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==}

  picomatch@2.3.1:
    resolution: {integrity: sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==}
    engines: {node: '>=8.6'}

  pino-abstract-transport@2.0.0:
    resolution: {integrity: sha512-F63x5tizV6WCh4R6RHyi2Ml+M70DNRXt/+HANowMflpgGFMAym/VKm6G7ZOQRjqN7XbGxK1Lg9t6ZrtzOaivMw==}

  pino-std-serializers@7.0.0:
    resolution: {integrity: sha512-e906FRY0+tV27iq4juKzSYPbUj2do2X2JX4EzSca1631EB2QJQUqGbDuERal7LCtOpxl6x3+nvo9NPZcmjkiFA==}

  pino@9.7.0:
    resolution: {integrity: sha512-vnMCM6xZTb1WDmLvtG2lE/2p+t9hDEIvTWJsu6FejkE62vB7gDhvzrpFR4Cw2to+9JNQxVnkAKVPA1KPB98vWg==}
    hasBin: true

  process-warning@4.0.1:
    resolution: {integrity: sha512-3c2LzQ3rY9d0hc1emcsHhfT9Jwz0cChib/QN89oME2R451w5fy3f0afAhERFZAwrbDU43wk12d0ORBpDVME50Q==}

  process-warning@5.0.0:
    resolution: {integrity: sha512-a39t9ApHNx2L4+HBnQKqxxHNs1r7KF+Intd8Q/g1bUh6q0WIp9voPXJ/x0j+ZL45KF1pJd9+q2jLIRMfvEshkA==}

  pump@3.0.3:
    resolution: {integrity: sha512-todwxLMY7/heScKmntwQG8CXVkWUOdYxIvY2s0VWAAMh/nd8SoYiRaKjlr7+iCs984f2P8zvrfWcDDYVb73NfA==}

  queue-microtask@1.2.3:
    resolution: {integrity: sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==}

  quick-format-unescaped@4.0.4:
    resolution: {integrity: sha512-tYC1Q1hgyRuHgloV/YXs2w15unPVh8qfu/qCTfhTYamaw7fyhumKa2yGpdSo87vY32rIclj+4fWYQXUMs9EHvg==}

  real-require@0.2.0:
    resolution: {integrity: sha512-57frrGM/OCTLqLOAh0mhVA9VBMHd+9U7Zb2THMGdBUoZVOtGbJzjxsYGDJ3A9AYYCP4hn6y1TVbaOfzWtm5GFg==}
    engines: {node: '>= 12.13.0'}

  rechoir@0.6.2:
    resolution: {integrity: sha512-HFM8rkZ+i3zrV+4LQjwQ0W+ez98pApMGM3HUrN04j3CqzPOzl9nmP15Y8YXNm8QHGv/eacOVEjqhmWpkRV0NAw==}
    engines: {node: '>= 0.10'}

  require-from-string@2.0.2:
    resolution: {integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==}
    engines: {node: '>=0.10.0'}

  resolve@1.22.10:
    resolution: {integrity: sha512-NPRy+/ncIMeDlTAsuqwKIiferiawhefFJtkNSW0qZJEqMEb+qBt/77B/jGeeek+F0uOeN05CDa6HXbbIgtVX4w==}
    engines: {node: '>= 0.4'}
    hasBin: true

  ret@0.5.0:
    resolution: {integrity: sha512-I1XxrZSQ+oErkRR4jYbAyEEu2I0avBvvMM5JN+6EBprOGRCs63ENqZ3vjavq8fBw2+62G5LF5XelKwuJpcvcxw==}
    engines: {node: '>=10'}

  reusify@1.1.0:
    resolution: {integrity: sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==}
    engines: {iojs: '>=1.0.0', node: '>=0.10.0'}

  rfdc@1.4.1:
    resolution: {integrity: sha512-q1b3N5QkRUWUl7iyylaaj3kOpIT0N2i9MqIEQXP73GVsN9cw3fdx8X63cEmWhJGi2PPCF23Ijp7ktmd39rawIA==}

  run-parallel@1.2.0:
    resolution: {integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==}

  safe-buffer@5.2.1:
    resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}

  safe-regex2@5.0.0:
    resolution: {integrity: sha512-YwJwe5a51WlK7KbOJREPdjNrpViQBI3p4T50lfwPuDhZnE3XGVTlGvi+aolc5+RvxDD6bnUmjVsU9n1eboLUYw==}

  safe-stable-stringify@2.5.0:
    resolution: {integrity: sha512-b3rppTKm9T+PsVCBEOUR46GWI7fdOs00VKZ1+9c1EWDaDMvjQc6tUwuFyIprgGgTcWoVHSKrU8H31ZHA2e0RHA==}
    engines: {node: '>=10'}

  secure-json-parse@4.0.0:
    resolution: {integrity: sha512-dxtLJO6sc35jWidmLxo7ij+Eg48PM/kleBsxpC8QJE0qJICe+KawkDQmvCMZUr9u7WKVHgMW6vy3fQ7zMiFZMA==}

  semver@5.7.2:
    resolution: {integrity: sha512-cBznnQ9KjJqU67B52RMC65CMarK2600WFnbkcaiwWq3xy/5haFJlshgnpjovMVJ+Hff49d8GEn0b87C5pDQ10g==}
    hasBin: true

  semver@7.7.2:
    resolution: {integrity: sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA==}
    engines: {node: '>=10'}
    hasBin: true

  set-cookie-parser@2.7.1:
    resolution: {integrity: sha512-IOc8uWeOZgnb3ptbCURJWNjWUPcO3ZnTTdzsurqERrP6nPyv+paC55vJM0LpOlT2ne+Ix+9+CRG1MNLlyZ4GjQ==}

  shebang-command@1.2.0:
    resolution: {integrity: sha512-EV3L1+UQWGor21OmnvojK36mhg+TyIKDh3iFBKBohr5xeXIhNBcx8oWdgkTEEQ+BEFFYdLRuqMfd5L84N1V5Vg==}
    engines: {node: '>=0.10.0'}

  shebang-regex@1.0.0:
    resolution: {integrity: sha512-wpoSFAxys6b2a2wHZ1XpDSgD7N9iVjg29Ph9uV/uaP9Ex/KXlkTZTeddxDPSYQpgvzKLGJke2UU0AzoGCjNIvQ==}
    engines: {node: '>=0.10.0'}

  shelljs@0.9.2:
    resolution: {integrity: sha512-S3I64fEiKgTZzKCC46zT/Ib9meqofLrQVbpSswtjFfAVDW+AZ54WTnAM/3/yENoxz/V1Cy6u3kiiEbQ4DNphvw==}
    engines: {node: '>=18'}
    hasBin: true

  shx@0.4.0:
    resolution: {integrity: sha512-Z0KixSIlGPpijKgcH6oCMCbltPImvaKy0sGH8AkLRXw1KyzpKtaCTizP2xen+hNDqVF4xxgvA0KXSb9o4Q6hnA==}
    engines: {node: '>=18'}
    hasBin: true

  signal-exit@3.0.7:
    resolution: {integrity: sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ==}

  sonic-boom@4.2.0:
    resolution: {integrity: sha512-INb7TM37/mAcsGmc9hyyI6+QR3rR1zVRu36B0NeGXKnOOLiZOfER5SA+N7X7k3yUYRzLWafduTDvJAfDswwEww==}

  split2@4.2.0:
    resolution: {integrity: sha512-UcjcJOWknrNkF6PLX83qcHM6KHgVKNkV62Y8a5uYDVv9ydGQVwAHMKqHdJje1VTWpljG0WYpCDhrCdAOYH4TWg==}
    engines: {node: '>= 10.x'}

  strip-eof@1.0.0:
    resolution: {integrity: sha512-7FCwGGmx8mD5xQd3RPUvnSpUXHM3BWuzjtpD4TXsfcZ9EL4azvVVUscFYwD9nx8Kh+uCBC00XBtAykoMHwTh8Q==}
    engines: {node: '>=0.10.0'}

  supports-preserve-symlinks-flag@1.0.0:
    resolution: {integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==}
    engines: {node: '>= 0.4'}

  thread-stream@3.1.0:
    resolution: {integrity: sha512-OqyPZ9u96VohAyMfJykzmivOrY2wfMSf3C5TtFJVgN+Hm6aj+voFhlK+kZEIv2FBh1X6Xp3DlnCOfEQ3B2J86A==}

  tiktoken@1.0.21:
    resolution: {integrity: sha512-/kqtlepLMptX0OgbYD9aMYbM7EFrMZCL7EoHM8Psmg2FuhXoo/bH64KqOiZGGwa6oS9TPdSEDKBnV2LuB8+5vQ==}

  to-regex-range@5.0.1:
    resolution: {integrity: sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==}
    engines: {node: '>=8.0'}

  toad-cache@3.7.0:
    resolution: {integrity: sha512-/m8M+2BJUpoJdgAHoG+baCwBT+tf2VraSfkBgl0Y00qIWt41DJ8R5B8nsEw0I58YwF5IZH6z24/2TobDKnqSWw==}
    engines: {node: '>=12'}

  tr46@0.0.3:
    resolution: {integrity: sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==}

  typescript@5.8.3:
    resolution: {integrity: sha512-p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ==}
    engines: {node: '>=14.17'}
    hasBin: true

  undici@7.11.0:
    resolution: {integrity: sha512-heTSIac3iLhsmZhUCjyS3JQEkZELateufzZuBaVM5RHXdSBMb1LPMQf5x+FH7qjsZYDP0ttAc3nnVpUB+wYbOg==}
    engines: {node: '>=20.18.1'}

  uuid@11.1.0:
    resolution: {integrity: sha512-0/A9rDy9P7cJ+8w1c9WD9V//9Wj15Ce2MPz8Ri6032usz+NfePxx5AcN3bN+r6ZL6jEo066/yNYB3tn4pQEx+A==}
    hasBin: true

  uuid@9.0.1:
    resolution: {integrity: sha512-b+1eJOlsR9K8HJpow9Ok3fiWOWSIcIzXodvv0rQjVoOVNpWMpxf1wZNpt4y9h10odCNrqnYp1OBzRktckBe3sA==}
    hasBin: true

  webidl-conversions@3.0.1:
    resolution: {integrity: sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==}

  whatwg-url@5.0.0:
    resolution: {integrity: sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==}

  which@1.3.1:
    resolution: {integrity: sha512-HxJdYWq1MTIQbJ3nw0cqssHoTNU267KlrDuGZ1WYlxDStUtKUhOaJmh112/TZmHxxUfuJqPXSOm7tDyas0OSIQ==}
    hasBin: true

  wrappy@1.0.2:
    resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}

  ws@8.18.3:
    resolution: {integrity: sha512-PEIGCY5tSlUt50cqyMXfCzX+oOPqN0vuGqWzbcJ2xvnkzkq46oOpz7dQaTDBdfICb4N14+GARUDw2XV2N4tvzg==}
    engines: {node: '>=10.0.0'}
    peerDependencies:
      bufferutil: ^4.0.1
      utf-8-validate: '>=5.0.2'
    peerDependenciesMeta:
      bufferutil:
        optional: true
      utf-8-validate:
        optional: true

  zod-to-json-schema@3.24.6:
    resolution: {integrity: sha512-h/z3PKvcTcTetyjl1fkj79MHNEjm+HpD6NXheWjzOekY7kV+lwDYnHw+ivHkijnCSMz1yJaWBD9vu/Fcmk+vEg==}
    peerDependencies:
      zod: ^3.24.1

  zod@3.25.67:
    resolution: {integrity: sha512-idA2YXwpCdqUSKRCACDE6ItZD9TZzy3OZMtpfLoh6oPR47lipysRrJfjzMqFxQ3uJuUPyUeWe1r9vLH33xO/Qw==}

snapshots:

  '@anthropic-ai/sdk@0.54.0': {}

  '@esbuild/aix-ppc64@0.25.5':
    optional: true

  '@esbuild/android-arm64@0.25.5':
    optional: true

  '@esbuild/android-arm@0.25.5':
    optional: true

  '@esbuild/android-x64@0.25.5':
    optional: true

  '@esbuild/darwin-arm64@0.25.5':
    optional: true

  '@esbuild/darwin-x64@0.25.5':
    optional: true

  '@esbuild/freebsd-arm64@0.25.5':
    optional: true

  '@esbuild/freebsd-x64@0.25.5':
    optional: true

  '@esbuild/linux-arm64@0.25.5':
    optional: true

  '@esbuild/linux-arm@0.25.5':
    optional: true

  '@esbuild/linux-ia32@0.25.5':
    optional: true

  '@esbuild/linux-loong64@0.25.5':
    optional: true

  '@esbuild/linux-mips64el@0.25.5':
    optional: true

  '@esbuild/linux-ppc64@0.25.5':
    optional: true

  '@esbuild/linux-riscv64@0.25.5':
    optional: true

  '@esbuild/linux-s390x@0.25.5':
    optional: true

  '@esbuild/linux-x64@0.25.5':
    optional: true

  '@esbuild/netbsd-arm64@0.25.5':
    optional: true

  '@esbuild/netbsd-x64@0.25.5':
    optional: true

  '@esbuild/openbsd-arm64@0.25.5':
    optional: true

  '@esbuild/openbsd-x64@0.25.5':
    optional: true

  '@esbuild/sunos-x64@0.25.5':
    optional: true

  '@esbuild/win32-arm64@0.25.5':
    optional: true

  '@esbuild/win32-ia32@0.25.5':
    optional: true

  '@esbuild/win32-x64@0.25.5':
    optional: true

  '@fastify/ajv-compiler@4.0.2':
    dependencies:
      ajv: 8.17.1
      ajv-formats: 3.0.1(ajv@8.17.1)
      fast-uri: 3.0.6

  '@fastify/cors@11.0.1':
    dependencies:
      fastify-plugin: 5.0.1
      toad-cache: 3.7.0

  '@fastify/error@4.2.0': {}

  '@fastify/fast-json-stringify-compiler@5.0.3':
    dependencies:
      fast-json-stringify: 6.0.1

  '@fastify/forwarded@3.0.0': {}

  '@fastify/merge-json-schemas@0.2.1':
    dependencies:
      dequal: 2.0.3

  '@fastify/proxy-addr@5.0.0':
    dependencies:
      '@fastify/forwarded': 3.0.0
      ipaddr.js: 2.2.0

  '@google/genai@1.8.0':
    dependencies:
      google-auth-library: 9.15.1
      ws: 8.18.3
      zod: 3.25.67
      zod-to-json-schema: 3.24.6(zod@3.25.67)
    transitivePeerDependencies:
      - bufferutil
      - encoding
      - supports-color
      - utf-8-validate

  '@musistudio/llms@1.0.8(ws@8.18.3)(zod@3.25.67)':
    dependencies:
      '@anthropic-ai/sdk': 0.54.0
      '@fastify/cors': 11.0.1
      '@google/genai': 1.8.0
      dotenv: 16.6.1
      fastify: 5.4.0
      openai: 5.8.2(ws@8.18.3)(zod@3.25.67)
      undici: 7.11.0
      uuid: 11.1.0
    transitivePeerDependencies:
      - '@modelcontextprotocol/sdk'
      - bufferutil
      - encoding
      - supports-color
      - utf-8-validate
      - ws
      - zod

  '@nodelib/fs.scandir@2.1.5':
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      run-parallel: 1.2.0

  '@nodelib/fs.stat@2.0.5': {}

  '@nodelib/fs.walk@1.2.8':
    dependencies:
      '@nodelib/fs.scandir': 2.1.5
      fastq: 1.19.1

  abstract-logging@2.0.1: {}

  agent-base@7.1.3: {}

  ajv-formats@3.0.1(ajv@8.17.1):
    optionalDependencies:
      ajv: 8.17.1

  ajv@8.17.1:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-uri: 3.0.6
      json-schema-traverse: 1.0.0
      require-from-string: 2.0.2

  atomic-sleep@1.0.0: {}

  avvio@9.1.0:
    dependencies:
      '@fastify/error': 4.2.0
      fastq: 1.19.1

  base64-js@1.5.1: {}

  bignumber.js@9.3.0: {}

  braces@3.0.3:
    dependencies:
      fill-range: 7.1.1

  buffer-equal-constant-time@1.0.1: {}

  cookie@1.0.2: {}

  cross-spawn@6.0.6:
    dependencies:
      nice-try: 1.0.5
      path-key: 2.0.1
      semver: 5.7.2
      shebang-command: 1.2.0
      which: 1.3.1

  debug@4.4.1:
    dependencies:
      ms: 2.1.3

  dequal@2.0.3: {}

  dotenv@16.6.1: {}

  ecdsa-sig-formatter@1.0.11:
    dependencies:
      safe-buffer: 5.2.1

  end-of-stream@1.4.5:
    dependencies:
      once: 1.4.0

  esbuild@0.25.5:
    optionalDependencies:
      '@esbuild/aix-ppc64': 0.25.5
      '@esbuild/android-arm': 0.25.5
      '@esbuild/android-arm64': 0.25.5
      '@esbuild/android-x64': 0.25.5
      '@esbuild/darwin-arm64': 0.25.5
      '@esbuild/darwin-x64': 0.25.5
      '@esbuild/freebsd-arm64': 0.25.5
      '@esbuild/freebsd-x64': 0.25.5
      '@esbuild/linux-arm': 0.25.5
      '@esbuild/linux-arm64': 0.25.5
      '@esbuild/linux-ia32': 0.25.5
      '@esbuild/linux-loong64': 0.25.5
      '@esbuild/linux-mips64el': 0.25.5
      '@esbuild/linux-ppc64': 0.25.5
      '@esbuild/linux-riscv64': 0.25.5
      '@esbuild/linux-s390x': 0.25.5
      '@esbuild/linux-x64': 0.25.5
      '@esbuild/netbsd-arm64': 0.25.5
      '@esbuild/netbsd-x64': 0.25.5
      '@esbuild/openbsd-arm64': 0.25.5
      '@esbuild/openbsd-x64': 0.25.5
      '@esbuild/sunos-x64': 0.25.5
      '@esbuild/win32-arm64': 0.25.5
      '@esbuild/win32-ia32': 0.25.5
      '@esbuild/win32-x64': 0.25.5

  execa@1.0.0:
    dependencies:
      cross-spawn: 6.0.6
      get-stream: 4.1.0
      is-stream: 1.1.0
      npm-run-path: 2.0.2
      p-finally: 1.0.0
      signal-exit: 3.0.7
      strip-eof: 1.0.0

  extend@3.0.2: {}

  fast-decode-uri-component@1.0.1: {}

  fast-deep-equal@3.1.3: {}

  fast-glob@3.3.3:
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      '@nodelib/fs.walk': 1.2.8
      glob-parent: 5.1.2
      merge2: 1.4.1
      micromatch: 4.0.8

  fast-json-stringify@6.0.1:
    dependencies:
      '@fastify/merge-json-schemas': 0.2.1
      ajv: 8.17.1
      ajv-formats: 3.0.1(ajv@8.17.1)
      fast-uri: 3.0.6
      json-schema-ref-resolver: 2.0.1
      rfdc: 1.4.1

  fast-querystring@1.1.2:
    dependencies:
      fast-decode-uri-component: 1.0.1

  fast-redact@3.5.0: {}

  fast-uri@3.0.6: {}

  fastify-plugin@5.0.1: {}

  fastify@5.4.0:
    dependencies:
      '@fastify/ajv-compiler': 4.0.2
      '@fastify/error': 4.2.0
      '@fastify/fast-json-stringify-compiler': 5.0.3
      '@fastify/proxy-addr': 5.0.0
      abstract-logging: 2.0.1
      avvio: 9.1.0
      fast-json-stringify: 6.0.1
      find-my-way: 9.3.0
      light-my-request: 6.6.0
      pino: 9.7.0
      process-warning: 5.0.0
      rfdc: 1.4.1
      secure-json-parse: 4.0.0
      semver: 7.7.2
      toad-cache: 3.7.0

  fastq@1.19.1:
    dependencies:
      reusify: 1.1.0

  fill-range@7.1.1:
    dependencies:
      to-regex-range: 5.0.1

  find-my-way@9.3.0:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-querystring: 1.1.2
      safe-regex2: 5.0.0

  function-bind@1.1.2: {}

  gaxios@6.7.1:
    dependencies:
      extend: 3.0.2
      https-proxy-agent: 7.0.6
      is-stream: 2.0.1
      node-fetch: 2.7.0
      uuid: 9.0.1
    transitivePeerDependencies:
      - encoding
      - supports-color

  gcp-metadata@6.1.1:
    dependencies:
      gaxios: 6.7.1
      google-logging-utils: 0.0.2
      json-bigint: 1.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color

  get-stream@4.1.0:
    dependencies:
      pump: 3.0.3

  glob-parent@5.1.2:
    dependencies:
      is-glob: 4.0.3

  google-auth-library@9.15.1:
    dependencies:
      base64-js: 1.5.1
      ecdsa-sig-formatter: 1.0.11
      gaxios: 6.7.1
      gcp-metadata: 6.1.1
      gtoken: 7.1.0
      jws: 4.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color

  google-logging-utils@0.0.2: {}

  gtoken@7.1.0:
    dependencies:
      gaxios: 6.7.1
      jws: 4.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color

  hasown@2.0.2:
    dependencies:
      function-bind: 1.1.2

  https-proxy-agent@7.0.6:
    dependencies:
      agent-base: 7.1.3
      debug: 4.4.1
    transitivePeerDependencies:
      - supports-color

  interpret@1.4.0: {}

  ipaddr.js@2.2.0: {}

  is-core-module@2.16.1:
    dependencies:
      hasown: 2.0.2

  is-extglob@2.1.1: {}

  is-glob@4.0.3:
    dependencies:
      is-extglob: 2.1.1

  is-number@7.0.0: {}

  is-stream@1.1.0: {}

  is-stream@2.0.1: {}

  isexe@2.0.0: {}

  json-bigint@1.0.0:
    dependencies:
      bignumber.js: 9.3.0

  json-schema-ref-resolver@2.0.1:
    dependencies:
      dequal: 2.0.3

  json-schema-traverse@1.0.0: {}

  jwa@2.0.1:
    dependencies:
      buffer-equal-constant-time: 1.0.1
      ecdsa-sig-formatter: 1.0.11
      safe-buffer: 5.2.1

  jws@4.0.0:
    dependencies:
      jwa: 2.0.1
      safe-buffer: 5.2.1

  light-my-request@6.6.0:
    dependencies:
      cookie: 1.0.2
      process-warning: 4.0.1
      set-cookie-parser: 2.7.1

  merge2@1.4.1: {}

  micromatch@4.0.8:
    dependencies:
      braces: 3.0.3
      picomatch: 2.3.1

  minimist@1.2.8: {}

  ms@2.1.3: {}

  nice-try@1.0.5: {}

  node-fetch@2.7.0:
    dependencies:
      whatwg-url: 5.0.0

  npm-run-path@2.0.2:
    dependencies:
      path-key: 2.0.1

  on-exit-leak-free@2.1.2: {}

  once@1.4.0:
    dependencies:
      wrappy: 1.0.2

  openai@5.8.2(ws@8.18.3)(zod@3.25.67):
    optionalDependencies:
      ws: 8.18.3
      zod: 3.25.67

  p-finally@1.0.0: {}

  path-key@2.0.1: {}

  path-parse@1.0.7: {}

  picomatch@2.3.1: {}

  pino-abstract-transport@2.0.0:
    dependencies:
      split2: 4.2.0

  pino-std-serializers@7.0.0: {}

  pino@9.7.0:
    dependencies:
      atomic-sleep: 1.0.0
      fast-redact: 3.5.0
      on-exit-leak-free: 2.1.2
      pino-abstract-transport: 2.0.0
      pino-std-serializers: 7.0.0
      process-warning: 5.0.0
      quick-format-unescaped: 4.0.4
      real-require: 0.2.0
      safe-stable-stringify: 2.5.0
      sonic-boom: 4.2.0
      thread-stream: 3.1.0

  process-warning@4.0.1: {}

  process-warning@5.0.0: {}

  pump@3.0.3:
    dependencies:
      end-of-stream: 1.4.5
      once: 1.4.0

  queue-microtask@1.2.3: {}

  quick-format-unescaped@4.0.4: {}

  real-require@0.2.0: {}

  rechoir@0.6.2:
    dependencies:
      resolve: 1.22.10

  require-from-string@2.0.2: {}

  resolve@1.22.10:
    dependencies:
      is-core-module: 2.16.1
      path-parse: 1.0.7
      supports-preserve-symlinks-flag: 1.0.0

  ret@0.5.0: {}

  reusify@1.1.0: {}

  rfdc@1.4.1: {}

  run-parallel@1.2.0:
    dependencies:
      queue-microtask: 1.2.3

  safe-buffer@5.2.1: {}

  safe-regex2@5.0.0:
    dependencies:
      ret: 0.5.0

  safe-stable-stringify@2.5.0: {}

  secure-json-parse@4.0.0: {}

  semver@5.7.2: {}

  semver@7.7.2: {}

  set-cookie-parser@2.7.1: {}

  shebang-command@1.2.0:
    dependencies:
      shebang-regex: 1.0.0

  shebang-regex@1.0.0: {}

  shelljs@0.9.2:
    dependencies:
      execa: 1.0.0
      fast-glob: 3.3.3
      interpret: 1.4.0
      rechoir: 0.6.2

  shx@0.4.0:
    dependencies:
      minimist: 1.2.8
      shelljs: 0.9.2

  signal-exit@3.0.7: {}

  sonic-boom@4.2.0:
    dependencies:
      atomic-sleep: 1.0.0

  split2@4.2.0: {}

  strip-eof@1.0.0: {}

  supports-preserve-symlinks-flag@1.0.0: {}

  thread-stream@3.1.0:
    dependencies:
      real-require: 0.2.0

  tiktoken@1.0.21: {}

  to-regex-range@5.0.1:
    dependencies:
      is-number: 7.0.0

  toad-cache@3.7.0: {}

  tr46@0.0.3: {}

  typescript@5.8.3: {}

  undici@7.11.0: {}

  uuid@11.1.0: {}

  uuid@9.0.1: {}

  webidl-conversions@3.0.1: {}

  whatwg-url@5.0.0:
    dependencies:
      tr46: 0.0.3
      webidl-conversions: 3.0.1

  which@1.3.1:
    dependencies:
      isexe: 2.0.0

  wrappy@1.0.2: {}

  ws@8.18.3: {}

  zod-to-json-schema@3.24.6(zod@3.25.67):
    dependencies:
      zod: 3.25.67

  zod@3.25.67: {}



================================================
FILE: README_zh.md
================================================
# Claude Code Router

> 一款强大的工具，可将 Claude Code 请求路由到不同的模型，并自定义任何请求。

![](blog/images/claude-code.png)

## ✨ 功能

-   **模型路由**: 根据您的需求将请求路由到不同的模型（例如，后台任务、思考、长上下文）。
-   **多提供商支持**: 支持 OpenRouter、DeepSeek、Ollama、Gemini、Volcengine 和 SiliconFlow 等各种模型提供商。
-   **请求/响应转换**: 使用转换器为不同的提供商自定义请求和响应。
-   **动态模型切换**: 在 Claude Code 中使用 `/model` 命令动态切换模型。
-   **GitHub Actions 集成**: 在您的 GitHub 工作流程中触发 Claude Code 任务。
-   **插件系统**: 使用自定义转换器扩展功能。

## 🚀 快速入门

### 1. 安装

首先，请确保您已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code/quickstart)：

```shell
npm install -g @anthropic-ai/claude-code
```

然后，安装 Claude Code Router：

```shell
npm install -g @musistudio/claude-code-router
```

### 2. 配置

创建并配置您的 `~/.claude-code-router/config.json` 文件。有关更多详细信息，您可以参考 `config.example.json`。

`config.json` 文件有几个关键部分：
- **`PROXY_URL`** (可选): 您可以为 API 请求设置代理，例如：`"PROXY_URL": "http://127.0.0.1:7890"`。
- **`LOG`** (可选): 您可以通过将其设置为 `true` 来启用日志记录。日志文件将位于 `$HOME/.claude-code-router.log`。
- **`APIKEY`** (可选): 您可以设置一个密钥来进行身份验证。设置后，客户端请求必须在 `Authorization` 请求头 (例如, `Bearer your-secret-key`) 或 `x-api-key` 请求头中提供此密钥。例如：`"APIKEY": "your-secret-key"`。
- **`HOST`** (可选): 您可以设置服务的主机地址。如果未设置 `APIKEY`，出于安全考虑，主机地址将强制设置为 `127.0.0.1`，以防止未经授权的访问。例如：`"HOST": "0.0.0.0"`。
- **`Providers`**: 用于配置不同的模型提供商。
- **`Router`**: 用于设置路由规则。`default` 指定默认模型，如果未配置其他路由，则该模型将用于所有请求。

这是一个综合示例：

```json
{
  "APIKEY": "your-secret-key",
  "PROXY_URL": "http://127.0.0.1:7890",
  "LOG": true,
  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": [
        "google/gemini-2.5-pro-preview",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-3.5-sonnet"
      ],
      "transformer": { "use": ["openrouter"] }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "sk-xxx",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      "transformer": {
        "use": ["deepseek"],
        "deepseek-chat": { "use": ["tooluse"] }
      }
    },
    {
      "name": "ollama",
      "api_base_url": "http://localhost:11434/v1/chat/completions",
      "api_key": "ollama",
      "models": ["qwen2.5-coder:latest"]
    }
  ],
  "Router": {
    "default": "deepseek,deepseek-chat",
    "background": "ollama,qwen2.5-coder:latest",
    "think": "deepseek,deepseek-reasoner",
    "longContext": "openrouter,google/gemini-2.5-pro-preview"
  }
}
```


### 3. 使用 Router 运行 Claude Code

使用 router 启动 Claude Code：

```shell
ccr code
```

#### Providers

`Providers` 数组是您定义要使用的不同模型提供商的地方。每个提供商对象都需要：

-   `name`: 提供商的唯一名称。
-   `api_base_url`: 聊天补全的完整 API 端点。
-   `api_key`: 您提供商的 API 密钥。
-   `models`: 此提供商可用的模型名称列表。
-   `transformer` (可选): 指定用于处理请求和响应的转换器。

#### Transformers

Transformers 允许您修改请求和响应负载，以确保与不同提供商 API 的兼容性。

-   **全局 Transformer**: 将转换器应用于提供商的所有模型。在此示例中，`openrouter` 转换器将应用于 `openrouter` 提供商下的所有模型。
    ```json
     {
       "name": "openrouter",
       "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
       "api_key": "sk-xxx",
       "models": [
         "google/gemini-2.5-pro-preview",
         "anthropic/claude-sonnet-4",
         "anthropic/claude-3.5-sonnet"
       ],
       "transformer": { "use": ["openrouter"] }
     }
    ```
-   **特定于模型的 Transformer**: 将转换器应用于特定模型。在此示例中，`deepseek` 转换器应用于所有模型，而额外的 `tooluse` 转换器仅应用于 `deepseek-chat` 模型。
    ```json
     {
       "name": "deepseek",
       "api_base_url": "https://api.deepseek.com/chat/completions",
       "api_key": "sk-xxx",
       "models": ["deepseek-chat", "deepseek-reasoner"],
       "transformer": {
         "use": ["deepseek"],
         "deepseek-chat": { "use": ["tooluse"] }
       }
     }
    ```

-   **向 Transformer 传递选项**: 某些转换器（如 `maxtoken`）接受选项。要传递选项，请使用嵌套数组，其中第一个元素是转换器名称，第二个元素是选项对象。
    ```json
    {
      "name": "siliconflow",
      "api_base_url": "https://api.siliconflow.cn/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": ["moonshotai/Kimi-K2-Instruct"],
      "transformer": {
        "use": [
          [
            "maxtoken",
            {
              "max_tokens": 16384
            }
          ]
        ]
      }
    }
    ```

**可用的内置 Transformer：**

-   `deepseek`: 适配 DeepSeek API 的请求/响应。
-   `gemini`: 适配 Gemini API 的请求/响应。
-   `openrouter`: 适配 OpenRouter API 的请求/响应。
-   `groq`: 适配 groq API 的请求/响应
-   `maxtoken`: 设置特定的 `max_tokens` 值。
-   `tooluse`: 优化某些模型的工具使用(通过`tool_choice`参数)。
-   `gemini-cli` (实验性): 通过 Gemini CLI [gemini-cli.js](https://gist.github.com/musistudio/1c13a65f35916a7ab690649d3df8d1cd) 对 Gemini 的非官方支持。

**自定义 Transformer:**

您还可以创建自己的转换器，并通过 `config.json` 中的 `transformers` 字段加载它们。

```json
{
  "transformers": [
      {
        "path": "$HOME/.claude-code-router/plugins/gemini-cli.js",
        "options": {
          "project": "xxx"
        }
      }
  ]
}
```

#### Router

`Router` 对象定义了在不同场景下使用哪个模型：

-   `default`: 用于常规任务的默认模型。
-   `background`: 用于后台任务的模型。这可以是一个较小的本地模型以节省成本。
-   `think`: 用于推理密集型任务（如计划模式）的模型。
-   `longContext`: 用于处理长上下文（例如，> 60K 令牌）的模型。

您还可以使用 `/model` 命令在 Claude Code 中动态切换模型：
`/model provider_name,model_name`
示例: `/model openrouter,anthropic/claude-3.5-sonnet`


## 🤖 GitHub Actions

将 Claude Code Router 集成到您的 CI/CD 管道中。在设置 [Claude Code Actions](https://docs.anthropic.com/en/docs/claude-code/github-actions) 后，修改您的 `.github/workflows/claude.yaml` 以使用路由器：

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  # ... other triggers

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      # ... other conditions
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Prepare Environment
        run: |
          curl -fsSL https://bun.sh/install | bash
          mkdir -p $HOME/.claude-code-router
          cat << 'EOF' > $HOME/.claude-code-router/config.json
          {
            "log": true,
            "OPENAI_API_KEY": "${{ secrets.OPENAI_API_KEY }}",
            "OPENAI_BASE_URL": "https://api.deepseek.com",
            "OPENAI_MODEL": "deepseek-chat"
          }
          EOF
        shell: bash

      - name: Start Claude Code Router
        run: |
          nohup ~/.bun/bin/bunx @musistudio/claude-code-router@1.0.8 start &
        shell: bash

      - name: Run Claude Code
        id: claude
        uses: anthropics/claude-code-action@beta
        env:
          ANTHROPIC_BASE_URL: http://localhost:3456
        with:
          anthropic_api_key: "any-string-is-ok"
```

这种设置可以实现有趣的自动化，例如在非高峰时段运行任务以降低 API 成本。

## 📝 深入阅读

-   [项目动机和工作原理](blog/zh/项目初衷及原理.md)
-   [也许我们可以用路由器做更多事情](blog/zh/或许我们能在Router中做更多事情.md)

## ❤️ 支持与赞助

如果您觉得这个项目有帮助，请考虑赞助它的开发。非常感谢您的支持！

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F31GN2GM)

<table>
  <tr>
    <td><img src="/blog/images/alipay.jpg" width="200" alt="Alipay" /></td>
    <td><img src="/blog/images/wechat.jpg" width="200" alt="WeChat Pay" /></td>
  </tr>
</table>

### 我们的赞助商

非常感谢所有赞助商的慷慨支持！

- @Simon Leischnig
- [@duanshuaimin](https://github.com/duanshuaimin)
- [@vrgitadmin](https://github.com/vrgitadmin)
- @*o
- [@ceilwoo](https://github.com/ceilwoo)
- @*说
- @*更
- @K*g
- @R*R
- [@bobleer](https://github.com/bobleer)
- @*苗
- @*划
- [@Clarence-pan](https://github.com/Clarence-pan)
- [@carter003](https://github.com/carter003)
- @S*r
- @*晖
- @*敏
- @Z*z
- @*然
- [@cluic](https://github.com/cluic)
- @*苗
- [@PromptExpert](https://github.com/PromptExpert)
- @*应
- [@yusnake](https://github.com/yusnake)
- @*飞
- @董*
- *汀
- *涯
- *:-）

（如果您的名字被屏蔽，请通过我的主页电子邮件与我联系，以便使用您的 GitHub 用户名进行更新。）


## 交流群
<img src="/blog/images/wechat_group.jpg" width="200" alt="wechat_group" />


================================================
FILE: tsconfig.json
================================================
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "noImplicitAny": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}



================================================
FILE: .dockerignore
================================================
node_modules
npm-debug.log



================================================
FILE: .npmignore
================================================
src
node_modules
.claude
CLAUDE.md
screenshoots
.DS_Store
.vscode
.idea
.env
.blog
docs
.log
blog
config.json



================================================
FILE: blog/en/maybe-we-can-do-more-with-the-route.md
================================================
# Maybe We Can Do More with the Router

Since the release of `claude-code-router`, I’ve received a lot of user feedback, and quite a few issues are still open. Most of them are related to support for different providers and the lack of tool usage from the deepseek model.

Originally, I created this project for personal use, mainly to access claude code at a lower cost. So, multi-provider support wasn’t part of the initial design. But during troubleshooting, I discovered that even though most providers claim to be compatible with the OpenAI-style `/chat/completions` interface, there are many subtle differences. For example:

1. When Gemini's tool parameter type is string, the `format` field only supports `date` and `date-time`, and there’s no tool call ID.

2. OpenRouter requires `cache_control` for caching.

3. The official DeepSeek API has a `max_output` of 8192, but Volcano Engine’s limit is even higher.

Aside from these, smaller providers often have quirks in their parameter handling. So I decided to create a new project, [musistudio/llms](https://github.com/musistudio/llms), to deal with these compatibility issues. It uses the OpenAI format as a base and introduces a generic Transformer interface for transforming both requests and responses.

Once a `Transformer` is implemented for each provider, it becomes possible to mix-and-match requests between them. For example, I implemented bidirectional conversion between Anthropic and OpenAI formats in `AnthropicTransformer`, which listens to the `/v1/messages` endpoint. Similarly, `GeminiTransformer` handles Gemini <-> OpenAI format conversions and listens to `/v1beta/models/:modelAndAction`.

When both requests and responses are transformed into a common format, they can interoperate seamlessly:

```
AnthropicRequest -> AnthropicTransformer -> OpenAIRequest -> GeminiTransformer -> GeminiRequest -> GeminiServer
```

```
GeminiResponse -> GeminiTransformer -> OpenAIResponse -> AnthropicTransformer -> AnthropicResponse
```

Using a middleware layer to smooth out differences may introduce some performance overhead, but the main goal here is to enable `claude-code-router` to support multiple providers.

As for the issue of DeepSeek’s lackluster tool usage — I found that it stems from poor instruction adherence in long conversations. Initially, the model actively calls tools, but after several rounds, it starts responding with plain text instead. My first workaround was injecting a system prompt to remind the model to use tools proactively. But in long contexts, the model tends to forget this instruction.

After reading the DeepSeek documentation, I noticed it supports the `tool_choice` parameter, which can be set to `"required"` to force the model to use at least one tool. I tested this by enabling the parameter, and it significantly improved the model’s tool usage. We can remove the setting when it's no longer necessary. With the help of the `Transformer` interface in [musistudio/llms](https://github.com/musistudio/llms), we can modify the request before it’s sent and adjust the response after it’s received.

Inspired by the Plan Mode in `claude code`, I implemented a similar Tool Mode for DeepSeek:

```typescript
export class TooluseTransformer implements Transformer {
  name = "tooluse";

  transformRequestIn(request: UnifiedChatRequest): UnifiedChatRequest {
    if (request.tools?.length) {
      request.messages.push({
        role: "system",
        content: `<system-reminder>Tool mode is active. The user expects you to proactively execute the most suitable tool to help complete the task. 
Before invoking a tool, you must carefully evaluate whether it matches the current task. If no available tool is appropriate for the task, you MUST call the \`ExitTool\` to exit tool mode — this is the only valid way to terminate tool mode.
Always prioritize completing the user's task effectively and efficiently by using tools whenever appropriate.</system-reminder>`,
      });
      request.tool_choice = "required";
      request.tools.unshift({
        type: "function",
        function: {
          name: "ExitTool",
          description: `Use this tool when you are in tool mode and have completed the task. This is the only valid way to exit tool mode.
IMPORTANT: Before using this tool, ensure that none of the available tools are applicable to the current task. You must evaluate all available options — only if no suitable tool can help you complete the task should you use ExitTool to terminate tool mode.
Examples:
1. Task: "Use a tool to summarize this document" — Do not use ExitTool if a summarization tool is available.
2. Task: "What’s the weather today?" — If no tool is available to answer, use ExitTool after reasoning that none can fulfill the task.`,
          parameters: {
            type: "object",
            properties: {
              response: {
                type: "string",
                description:
                  "Your response will be forwarded to the user exactly as returned — the tool will not modify or post-process it in any way.",
              },
            },
            required: ["response"],
          },
        },
      });
    }
    return request;
  }

  async transformResponseOut(response: Response): Promise<Response> {
    if (response.headers.get("Content-Type")?.includes("application/json")) {
      const jsonResponse = await response.json();
      if (
        jsonResponse?.choices[0]?.message.tool_calls?.length &&
        jsonResponse?.choices[0]?.message.tool_calls[0]?.function?.name ===
          "ExitTool"
      ) {
        const toolArguments = JSON.parse(toolCall.function.arguments || "{}");
        jsonResponse.choices[0].message.content = toolArguments.response || "";
        delete jsonResponse.choices[0].message.tool_calls;
      }

      // Handle non-streaming response if needed
      return new Response(JSON.stringify(jsonResponse), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } else if (response.headers.get("Content-Type")?.includes("stream")) {
      // ...
    }
    return response;
  }
}
```

This transformer ensures the model calls at least one tool. If no tools are appropriate or the task is finished, it can exit using `ExitTool`. Since this relies on the `tool_choice` parameter, it only works with models that support it.

In practice, this approach noticeably improves tool usage for DeepSeek. The tradeoff is that sometimes the model may invoke irrelevant or unnecessary tools, which could increase latency and token usage.

This update is just a small experiment — adding an `“agent”` to the router. Maybe there are more interesting things we can explore from here.


================================================
FILE: blog/en/project-motivation-and-how-it-works.md
================================================
# Project Motivation and Principles

As early as the day after Claude Code was released (2025-02-25), I began and completed a reverse engineering attempt of the project. At that time, using Claude Code required registering for an Anthropic account, applying for a waitlist, and waiting for approval. However, due to well-known reasons, Anthropic blocks users from mainland China, making it impossible for me to use the service through normal means. Based on known information, I discovered the following:

1. Claude Code is installed via npm, so it's very likely developed with Node.js.
2. Node.js offers various debugging methods: simple `console.log` usage, launching with `--inspect` to hook into Chrome DevTools, or even debugging obfuscated code using `d8`.

My goal was to use Claude Code without an Anthropic account. I didn’t need the full source code—just a way to intercept and reroute requests made by Claude Code to Anthropic’s models to my own custom endpoint. So I started the reverse engineering process:

1. First, install Claude Code:
```bash
npm install -g @anthropic-ai/claude-code
```

2. After installation, the project is located at `~/.nvm/versions/node/v20.10.0/lib/node_modules/@anthropic-ai/claude-code`(this may vary depending on your Node version manager and version).

3. Open the package.json to analyze the entry point:
```package.json
{
  "name": "@anthropic-ai/claude-code",
  "version": "1.0.24",
  "main": "sdk.mjs",
  "types": "sdk.d.ts",
  "bin": {
    "claude": "cli.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "type": "module",
  "author": "Boris Cherny <boris@anthropic.com>",
  "license": "SEE LICENSE IN README.md",
  "description": "Use Claude, Anthropic's AI assistant, right from your terminal. Claude can understand your codebase, edit files, run terminal commands, and handle entire workflows for you.",
  "homepage": "https://github.com/anthropics/claude-code",
  "bugs": {
    "url": "https://github.com/anthropics/claude-code/issues"
  },
  "scripts": {
    "prepare": "node -e \"if (!process.env.AUTHORIZED) { console.error('ERROR: Direct publishing is not allowed.\\nPlease use the publish-external.sh script to publish this package.'); process.exit(1); }\"",
    "preinstall": "node scripts/preinstall.js"
  },
  "dependencies": {},
  "optionalDependencies": {
    "@img/sharp-darwin-arm64": "^0.33.5",
    "@img/sharp-darwin-x64": "^0.33.5",
    "@img/sharp-linux-arm": "^0.33.5",
    "@img/sharp-linux-arm64": "^0.33.5",
    "@img/sharp-linux-x64": "^0.33.5",
    "@img/sharp-win32-x64": "^0.33.5"
  }
}
```

The key entry is `"claude": "cli.js"`. Opening cli.js, you'll see the code is minified and obfuscated. But using WebStorm’s `Format File` feature, you can reformat it for better readability:
![webstorm-formate-file](../images/webstorm-formate-file.png)

Now you can begin understanding Claude Code’s internal logic and prompt structure by reading the code. To dig deeper, you can insert console.log statements or launch in debug mode with Chrome DevTools using:

```bash
NODE_OPTIONS="--inspect-brk=9229" claude
```

This command starts Claude Code in debug mode and opens port 9229. Visit chrome://inspect/ in Chrome and click inspect to begin debugging:
![chrome-devtools](../images/chrome-inspect.png)
![chrome-devtools](../images/chrome-devtools.png)

By searching for the keyword api.anthropic.com, you can easily locate where Claude Code makes its API calls. From the surrounding code, it's clear that baseURL can be overridden with the `ANTHROPIC_BASE_URL` environment variable, and `apiKey` and `authToken` can be configured similarly:
![search](../images/search.png)

So far, we’ve discovered some key information:

1. Environment variables can override Claude Code's `baseURL` and `apiKey`.

2. Claude Code adheres to the Anthropic API specification.

Therefore, we need:
1. A service to convert OpenAI API–compatible requests into Anthropic API format.

2. Set the environment variables before launching Claude Code to redirect requests to this service.

Thus, `claude-code-router` was born. This project uses `Express.js` to implement the `/v1/messages` endpoint. It leverages middlewares to transform request/response formats and supports request rewriting (useful for prompt tuning per model).

Back in February, the full DeepSeek model series had poor support for Function Calling, so I initially used `qwen-max`. It worked well—but without KV cache support, it consumed a large number of tokens and couldn’t provide the native `Claude Code` experience.

So I experimented with a Router-based mode using a lightweight model to dispatch tasks. The architecture included four roles: `router`, `tool`, `think`, and `coder`. Each request passed through a free lightweight model that would decide whether the task involved reasoning, coding, or tool usage. Reasoning and coding tasks looped until a tool was invoked to apply changes. However, the lightweight model lacked the capability to route tasks accurately, and architectural issues prevented it from effectively driving Claude Code.

Everything changed at the end of May when the official Claude Code was launched, and `DeepSeek-R1` model (released 2025-05-28) added Function Call support. I redesigned the system. With the help of AI pair programming, I fixed earlier request/response transformation issues—especially the handling of models that return JSON instead of Function Call outputs.

This time, I used the `DeepSeek-V3`  model. It performed better than expected: supporting most tool calls, handling task decomposition and stepwise planning, and—most importantly—costing less than one-tenth the price of Claude 3.5 Sonnet.

The official Claude Code organizes agents differently from the beta version, so I restructured my Router mode to include four roles: the default model, `background`, `think`, and `longContext`.

- The default model handles general tasks and acts as a fallback.

- The `background` model manages lightweight background tasks. According to Anthropic, Claude Haiku 3.5 is often used here, so I routed this to a local `ollama` service.

- The `think` model is responsible for reasoning and planning mode tasks. I use `DeepSeek-R1` here, though it doesn’t support cost control, so `Think` and `UltraThink` behave identically.

- The `longContext` model handles long-context scenarios. The router uses `tiktoken` to calculate token lengths in real time, and if the context exceeds 32K, it switches to this model to compensate for DeepSeek's long-context limitations.

This describes the evolution and reasoning behind the project. By cleverly overriding environment variables, we can forward and modify requests without altering Claude Code’s source—allowing us to benefit from official updates while using our own models and custom prompts.

This project offers a practical approach to running Claude Code under Anthropic’s regional restrictions, balancing `cost`, `performance`, and `customizability`. That said, the official `Max Plan` still offers the best experience if available.


================================================
FILE: blog/zh/或许我们能在Router中做更多事情.md
================================================
[Binary file]


================================================
FILE: blog/zh/项目初衷及原理.md
================================================
# 项目初衷及原理

早在 Claude Code 发布的第二天(2025-02-25)，我就尝试并完成了对该项目的逆向。当时要使用 Claude Code 你需要注册一个 Anthropic 账号，然后申请 waitlist，等待通过后才能使用。但是因为众所周知的原因，Anthropic 屏蔽了中国区的用户，所以通过正常手段我无法使用，通过已知的信息，我发现：

1. Claude Code 使用 npm 进行安装，所以很大可能其使用 Node.js 进行开发。
2. Node.js 调试手段众多，可以简单使用`console.log`获取想要的信息，也可以使用`--inspect`将其接入`Chrome Devtools`，甚至你可以使用`d8`去调试某些加密混淆的代码。

由于我的目标是让我在没有 Anthropic 账号的情况下使用`Claude Code`，我并不需要获得完整的源代码，只需要将`Claude Code`请求 Anthropic 模型时将其转发到我自定义的接口即可。接下来我就开启了我的逆向过程：

1. 首先安装`Claude Code`

```bash
npm install -g @anthropic-ai/claude-code
```

2. 安装后该项目被放在了`~/.nvm/versions/node/v20.10.0/lib/node_modules/@anthropic-ai/claude-code`中，因为我使用了`nvm`作为我的 node 版本控制器，当前使用`node-v20.10.0`，所以该路径会因人而异。
3. 找到项目路径之后可通过 package.json 分析包入口,内容如下：

```package.json
{
  "name": "@anthropic-ai/claude-code",
  "version": "1.0.24",
  "main": "sdk.mjs",
  "types": "sdk.d.ts",
  "bin": {
    "claude": "cli.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "type": "module",
  "author": "Boris Cherny <boris@anthropic.com>",
  "license": "SEE LICENSE IN README.md",
  "description": "Use Claude, Anthropic's AI assistant, right from your terminal. Claude can understand your codebase, edit files, run terminal commands, and handle entire workflows for you.",
  "homepage": "https://github.com/anthropics/claude-code",
  "bugs": {
    "url": "https://github.com/anthropics/claude-code/issues"
  },
  "scripts": {
    "prepare": "node -e \"if (!process.env.AUTHORIZED) { console.error('ERROR: Direct publishing is not allowed.\\nPlease use the publish-external.sh script to publish this package.'); process.exit(1); }\"",
    "preinstall": "node scripts/preinstall.js"
  },
  "dependencies": {},
  "optionalDependencies": {
    "@img/sharp-darwin-arm64": "^0.33.5",
    "@img/sharp-darwin-x64": "^0.33.5",
    "@img/sharp-linux-arm": "^0.33.5",
    "@img/sharp-linux-arm64": "^0.33.5",
    "@img/sharp-linux-x64": "^0.33.5",
    "@img/sharp-win32-x64": "^0.33.5"
  }
}
```

其中`"claude": "cli.js"`就是我们要找的入口，打开 cli.js，发现代码被压缩混淆过了。没关系，借助`webstorm`的`Formate File`功能可以重新格式化，让代码变得稍微好看一点。就像这样：
![webstorm-formate-file](../images/webstorm-formate-file.png)

现在，你可以通过阅读部分代码来了解`Claude Code`的内容工具原理与提示词。你也可以在关键地方使用`console.log`来获得更多信息，当然，也可以使用`Chrome Devtools`来进行断点调试，使用以下命令启动`Claude Code`:

```bash
NODE_OPTIONS="--inspect-brk=9229" claude
```

该命令会以调试模式启动`Claude Code`，并将调试的端口设置为`9229`。这时候通过 Chrome 访问`chrome://inspect/`即可看到当前的`Claude Code`进程，点击`inspect`即可进行调试。
![chrome-devtools](../images/chrome-inspect.png)
![chrome-devtools](../images/chrome-devtools.png)

通过搜索关键字符`api.anthropic.com`很容易能找到`Claude Code`用来发请求的地方，根据上下文的查看，很容易发现这里的`baseURL`可以通过环境变量`ANTHROPIC_BASE_URL`进行覆盖，`apiKey`和`authToken`也同理。
![search](../images/search.png)

到目前为止，我们获得关键信息：

1. 可以使用环境变量覆盖`Claude Code`的`BaseURL`和`apiKey`的配置

2. `Claude Code`使用[Anthropic API](https://docs.anthropic.com/en/api/overview)的规范

所以我们需要：

1. 实现一个服务用来将`OpenAI API`的规范转换成`Anthropic API`格式。

2. 启动`Claude Code`之前写入环境变量将`baseURL`指向到该服务。

于是，`claude-code-router`就诞生了，该项目使用`Express.js`作为 HTTP 服务，实现`/v1/messages`端点，使用`middlewares`处理请求/响应的格式转换以及请求重写功能(可以用来重写 Claude Code 的提示词以针对单个模型进行调优)。
在 2 月份由于`DeepSeek`全系列模型对`Function Call`的支持不佳导致无法直接使用`DeepSeek`模型，所以在当时我选择了`qwen-max`模型，一切表现的都很好，但是`qwen-max`不支持`KV Cache`，意味着我要消耗大量的 token，但是却无法获取`Claude Code`原生的体验。
所以我又尝试了`Router`模式，即使用一个小模型对任务进行分发，一共分为四个模型:`router`、`tool`、`think`和`coder`，所有的请求先经过一个免费的小模型，由小模型去判断应该是进行思考还是编码还是调用工具，再进行任务的分发，如果是思考和编码任务将会进行循环调用，直到最终使用工具写入或修改文件。但是实践下来发现免费的小模型不足以很好的完成任务的分发，再加上整个 Agnet 的设计存在缺陷，导致并不能很好的驱动`Claude Code`。
直到 5 月底，`Claude Code`被正式推出，这时`DeepSeek`全系列模型(R1 于 05-28)均支持`Function Call`，我开始重新设计该项目。在与 AI 的结对编程中我修复了之前的请求和响应转换问题，在某些场景下模型输出 JSON 响应而不是`Function Call`。这次直接使用`DeepSeek-v3`模型，它工作的比我想象中要好：能完成绝大多数工具调用，还支持用步骤规划解决任务，最关键的是`DeepSeek`的价格不到`claude Sonnet 3.5`的十分之一。正式发布的`Claude Code`对 Agent 的组织也不同于测试版，于是在分析了`Claude Code`的请求调用之后，我重新组织了`Router`模式：现在它还是四个模型：默认模型、`background`、`think`和`longContext`。

- 默认模型作为最终的兜底和日常处理

- `background`是用来处理一些后台任务，据 Anthropic 官方说主要用`Claude Haiku 3.5`模型去处理一些小任务，如俳句生成和对话摘要，于是我将其路由到了本地的`ollama`服务。

- `think`模型用于让`Claude Code`进行思考或者在`Plan Mode`下使用，这里我使用的是`DeepSeek-R1`，由于其不支持推理成本控制，所以`Think`和`UltraThink`是一样的逻辑。

- `longContext`是用于处理长下上文的场景，该项目会对每次请求使用tiktoken实时计算上下文长度，如果上下文大于32K则使用该模型，旨在弥补`DeepSeek`在长上下文处理不佳的情况。

以上就是该项目的发展历程以及我的一些思考，通过巧妙的使用环境变量覆盖的手段在不修改`Claude Code`源码的情况下完成请求的转发和修改，这就使得在可以得到 Anthropic 更新的同时使用自己的模型，自定义自己的提示词。该项目只是在 Anthropic 封禁中国区用户的情况下使用`Claude Code`并且达到成本和性能平衡的一种手段。如果可以的话，还是官方的Max Plan体验最好。



================================================
FILE: src/cli.ts
================================================
#!/usr/bin/env node
import { run } from "./index";
import { showStatus } from "./utils/status";
import { executeCodeCommand } from "./utils/codeCommand";
import { cleanupPidFile, isServiceRunning } from "./utils/processCheck";
import { version } from "../package.json";
import { spawn } from "child_process";
import { PID_FILE, REFERENCE_COUNT_FILE } from "./constants";
import { existsSync, readFileSync } from "fs";
import {join} from "path";

const command = process.argv[2];

const HELP_TEXT = `
Usage: ccr [command]

Commands:
  start         Start service 
  stop          Stop service
  status        Show service status
  code          Execute code command
  -v, version   Show version information
  -h, help      Show help information

Example:
  ccr start
  ccr code "Write a Hello World"
`;

async function waitForService(
  timeout = 10000,
  initialDelay = 1000
): Promise<boolean> {
  // Wait for an initial period to let the service initialize
  await new Promise((resolve) => setTimeout(resolve, initialDelay));

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (isServiceRunning()) {
      // Wait for an additional short period to ensure service is fully ready
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function main() {
  switch (command) {
    case "start":
      run();
      break;
    case "stop":
      try {
        const pid = parseInt(readFileSync(PID_FILE, "utf-8"));
        process.kill(pid);
        cleanupPidFile();
        if (existsSync(REFERENCE_COUNT_FILE)) {
          try {
            require("fs").unlinkSync(REFERENCE_COUNT_FILE);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        console.log(
          "claude code router service has been successfully stopped."
        );
      } catch (e) {
        console.log(
          "Failed to stop the service. It may have already been stopped."
        );
        cleanupPidFile();
      }
      break;
    case "status":
      showStatus();
      break;
    case "code":
      if (!isServiceRunning()) {
        console.log("Service not running, starting service...");
        const cliPath = join(__dirname, "cli.js");
        const startProcess = spawn("node", [cliPath, "start"], {
          detached: true,
          stdio: "ignore",
        });

        startProcess.on("error", (error) => {
          console.error("Failed to start service:", error);
          process.exit(1);
        });

        startProcess.unref();

        if (await waitForService()) {
          executeCodeCommand(process.argv.slice(3));
        } else {
          console.error(
            "Service startup timeout, please manually run `ccr start` to start the service"
          );
          process.exit(1);
        }
      } else {
        executeCodeCommand(process.argv.slice(3));
      }
      break;
    case "-v":
    case "version":
      console.log(`claude-code-router version: ${version}`);
      break;
    case "-h":
    case "help":
      console.log(HELP_TEXT);
      break;
    default:
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main().catch(console.error);



================================================
FILE: src/constants.ts
================================================
import path from "node:path";
import os from "node:os";

export const HOME_DIR = path.join(os.homedir(), ".claude-code-router");

export const CONFIG_FILE = path.join(HOME_DIR, "config.json");

export const PLUGINS_DIR = path.join(HOME_DIR, "plugins");

export const PID_FILE = path.join(HOME_DIR, '.claude-code-router.pid');

export const REFERENCE_COUNT_FILE = path.join(os.tmpdir(), "claude-code-reference-count.txt");


export const DEFAULT_CONFIG = {
  LOG: false,
  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_MODEL: "",
};



================================================
FILE: src/index.ts
================================================
import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { initConfig, initDir } from "./utils";
import { createServer } from "./server";
import { router } from "./utils/router";
import { apiKeyAuth } from "./middleware/auth";
import {
  cleanupPidFile,
  isServiceRunning,
  savePid,
} from "./utils/processCheck";
import { CONFIG_FILE } from "./constants";

async function initializeClaudeConfig() {
  const homeDir = homedir();
  const configPath = join(homeDir, ".claude.json");
  if (!existsSync(configPath)) {
    const userID = Array.from(
      { length: 64 },
      () => Math.random().toString(16)[2]
    ).join("");
    const configContent = {
      numStartups: 184,
      autoUpdaterStatus: "enabled",
      userID,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: "1.0.17",
      projects: {},
    };
    await writeFile(configPath, JSON.stringify(configContent, null, 2));
  }
}

interface RunOptions {
  port?: number;
}

async function run(options: RunOptions = {}) {
  // Check if service is already running
  if (isServiceRunning()) {
    console.log("✅ Service is already running in the background.");
    return;
  }

  await initializeClaudeConfig();
  await initDir();
  const config = await initConfig();
  let HOST = config.HOST;

  if (config.HOST && !config.APIKEY) {
    HOST = "127.0.0.1";
    console.warn(
      "⚠️ API key is not set. HOST is forced to 127.0.0.1."
    );
  }

  const port = options.port || 3456;

  // Save the PID of the background process
  savePid(process.pid);

  // Handle SIGINT (Ctrl+C) to clean up PID file
  process.on("SIGINT", () => {
    console.log("Received SIGINT, cleaning up...");
    cleanupPidFile();
    process.exit(0);
  });

  // Handle SIGTERM to clean up PID file
  process.on("SIGTERM", () => {
    cleanupPidFile();
    process.exit(0);
  });
  console.log(HOST)

  // Use port from environment variable if set (for background process)
  const servicePort = process.env.SERVICE_PORT
    ? parseInt(process.env.SERVICE_PORT)
    : port;
  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      // ...config,
      providers: config.Providers || config.providers,
      HOST: HOST,
      PORT: servicePort,
      LOG_FILE: join(
        homedir(),
        ".claude-code-router",
        "claude-code-router.log"
      ),
    },
  });
  server.addHook("preHandler", apiKeyAuth(config));
  server.addHook("preHandler", async (req, reply) =>
    router(req, reply, config)
  );
  server.start();
}

export { run };
// run();



================================================
FILE: src/server.ts
================================================
import Server from "@musistudio/llms";

export const createServer = (config: any): Server => {
  const server = new Server(config);
  return server;
};



================================================
FILE: src/middleware/auth.ts
================================================
import { FastifyRequest, FastifyReply } from "fastify";

export const apiKeyAuth =
  (config: any) =>
  (req: FastifyRequest, reply: FastifyReply, done: () => void) => {
    if (["/", "/health"].includes(req.url)) {
      return done();
    }
    const apiKey = config.APIKEY;

    if (!apiKey) {
      return done();
    }

    const authKey: string =
      req.headers.authorization || req.headers["x-api-key"];
    if (!authKey) {
      reply.status(401).send("APIKEY is missing");
      return;
    }
    let token = "";
    if (authKey.startsWith("Bearer")) {
      token = authKey.split(" ")[1];
    } else {
      token = authKey;
    }
    if (token !== apiKey) {
      reply.status(401).send("Invalid API key");
      return;
    }

    done();
  };



================================================
FILE: src/utils/close.ts
================================================
import { isServiceRunning, cleanupPidFile, getReferenceCount } from './processCheck';
import { readFileSync } from 'fs';
import { HOME_DIR } from '../constants';
import { join } from 'path';

export async function closeService() {
    const PID_FILE = join(HOME_DIR, '.claude-code-router.pid');
    
    if (!isServiceRunning()) {
        console.log("No service is currently running.");
        return;
    }

    if (getReferenceCount() > 0) {
        return;
    }

    try {
        const pid = parseInt(readFileSync(PID_FILE, 'utf-8'));
        process.kill(pid);
        cleanupPidFile();
        console.log("claude code router service has been successfully stopped.");
    } catch (e) {
        console.log("Failed to stop the service. It may have already been stopped.");
        cleanupPidFile();
    }
}



================================================
FILE: src/utils/codeCommand.ts
================================================
import { spawn } from "child_process";
import {
  incrementReferenceCount,
  decrementReferenceCount,
} from "./processCheck";
import { closeService } from "./close";
import { readConfigFile } from ".";

export async function executeCodeCommand(args: string[] = []) {
  // Set environment variables
  const config = await readConfigFile();
  const env = {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: "test",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:3456`,
    API_TIMEOUT_MS: "600000",
  };

  if (config?.APIKEY) {
    env.ANTHROPIC_API_KEY = config.APIKEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
  }

  // Increment reference count when command starts
  incrementReferenceCount();

  // Execute claude command
  const claudePath = process.env.CLAUDE_PATH || "claude";
  const claudeProcess = spawn(claudePath, args, {
    env,
    stdio: "inherit",
    shell: true,
  });

  claudeProcess.on("error", (error) => {
    console.error("Failed to start claude command:", error.message);
    console.log(
      "Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code"
    );
    decrementReferenceCount();
    process.exit(1);
  });

  claudeProcess.on("close", (code) => {
    decrementReferenceCount();
    closeService();
    process.exit(code || 0);
  });
}



================================================
FILE: src/utils/index.ts
================================================
import fs from "node:fs/promises";
import readline from "node:readline";
import {
  CONFIG_FILE,
  DEFAULT_CONFIG,
  HOME_DIR,
  PLUGINS_DIR,
} from "../constants";

const ensureDir = async (dir_path: string) => {
  try {
    await fs.access(dir_path);
  } catch {
    await fs.mkdir(dir_path, { recursive: true });
  }
};

export const initDir = async () => {
  await ensureDir(HOME_DIR);
  await ensureDir(PLUGINS_DIR);
};

const createReadline = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
};

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    const rl = createReadline();
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const confirm = async (query: string): Promise<boolean> => {
  const answer = await question(query);
  return answer.toLowerCase() !== "n";
};

export const readConfigFile = async () => {
  try {
    const config = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(config);
  } catch {
    const name = await question("Enter Provider Name: ");
    const APIKEY = await question("Enter Provider API KEY: ");
    const baseUrl = await question("Enter Provider URL: ");
    const model = await question("Enter MODEL Name: ");
    const config = Object.assign({}, DEFAULT_CONFIG, {
      Providers: [
        {
          name,
          api_base_url: baseUrl,
          api_key: APIKEY,
          models: [model],
        },
      ],
      Router: {
        default: `${name},${model}`,
      },
    });
    await writeConfigFile(config);
    return config;
  }
};

export const writeConfigFile = async (config: any) => {
  await ensureDir(HOME_DIR);
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
};

export const initConfig = async () => {
  const config = await readConfigFile();
  Object.assign(process.env, config);
  return config;
};



================================================
FILE: src/utils/log.ts
================================================
import fs from "node:fs";
import path from "node:path";
import { HOME_DIR } from "../constants";

const LOG_FILE = path.join(HOME_DIR, "claude-code-router.log");

// Ensure log directory exists
if (!fs.existsSync(HOME_DIR)) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
}

export function log(...args: any[]) {
  // Check if logging is enabled via environment variable
  const isLogEnabled = process.env.LOG === "true";

  if (!isLogEnabled) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${
    Array.isArray(args)
      ? args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ")
      : ""
  }\n`;

  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage, "utf8");
}



================================================
FILE: src/utils/processCheck.ts
================================================
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { PID_FILE, REFERENCE_COUNT_FILE } from '../constants';

export function incrementReferenceCount() {
    let count = 0;
    if (existsSync(REFERENCE_COUNT_FILE)) {
        count = parseInt(readFileSync(REFERENCE_COUNT_FILE, 'utf-8')) || 0;
    }
    count++;
    writeFileSync(REFERENCE_COUNT_FILE, count.toString());
}

export function decrementReferenceCount() {
    let count = 0;
    if (existsSync(REFERENCE_COUNT_FILE)) {
        count = parseInt(readFileSync(REFERENCE_COUNT_FILE, 'utf-8')) || 0;
    }
    count = Math.max(0, count - 1);
    writeFileSync(REFERENCE_COUNT_FILE, count.toString());
}

export function getReferenceCount(): number {
    if (!existsSync(REFERENCE_COUNT_FILE)) {
        return 0;
    }
    return parseInt(readFileSync(REFERENCE_COUNT_FILE, 'utf-8')) || 0;
}

export function isServiceRunning(): boolean {
    if (!existsSync(PID_FILE)) {
        return false;
    }

    try {
        const pid = parseInt(readFileSync(PID_FILE, 'utf-8'));
        process.kill(pid, 0);
        return true;
    } catch (e) {
        // Process not running, clean up pid file
        cleanupPidFile();
        return false;
    }
}

export function savePid(pid: number) {
    writeFileSync(PID_FILE, pid.toString());
}

export function cleanupPidFile() {
    if (existsSync(PID_FILE)) {
        try {
            const fs = require('fs');
            fs.unlinkSync(PID_FILE);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

export function getServicePid(): number | null {
    if (!existsSync(PID_FILE)) {
        return null;
    }
    
    try {
        const pid = parseInt(readFileSync(PID_FILE, 'utf-8'));
        return isNaN(pid) ? null : pid;
    } catch (e) {
        return null;
    }
}

export function getServiceInfo() {
    const pid = getServicePid();
    const running = isServiceRunning();
    
    return {
        running,
        pid,
        port: 3456,
        endpoint: 'http://127.0.0.1:3456',
        pidFile: PID_FILE,
        referenceCount: getReferenceCount()
    };
}



================================================
FILE: src/utils/router.ts
================================================
import { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { get_encoding } from "tiktoken";
import { log } from "./log";

const enc = get_encoding("cl100k_base");

const getUseModel = (req: any, tokenCount: number, config: any) => {
  if (req.body.model.includes(",")) {
    return req.body.model;
  }
  // if tokenCount is greater than 60K, use the long context model
  if (tokenCount > 1000 * 60 && config.Router.longContext) {
    log("Using long context model due to token count:", tokenCount);
    return config.Router.longContext;
  }
  // If the model is claude-3-5-haiku, use the background model
  if (req.body.model?.startsWith("claude-3-5-haiku") && config.Router.background) {
    log("Using background model for ", req.body.model);
    return config.Router.background;
  }
  // if exits thinking, use the think model
  if (req.body.thinking && config.Router.think) {
    log("Using think model for ", req.body.thinking);
    return config.Router.think;
  }
  return config.Router!.default;
};

export const router = async (req: any, res: any, config: any) => {
  const { messages, system = [], tools }: MessageCreateParamsBase = req.body;
  try {
    let tokenCount = 0;
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        if (typeof message.content === "string") {
          tokenCount += enc.encode(message.content).length;
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart) => {
            if (contentPart.type === "text") {
              tokenCount += enc.encode(contentPart.text).length;
            } else if (contentPart.type === "tool_use") {
              tokenCount += enc.encode(
                JSON.stringify(contentPart.input)
              ).length;
            } else if (contentPart.type === "tool_result") {
              tokenCount += enc.encode(
                typeof contentPart.content === "string"
                  ? contentPart.content
                  : JSON.stringify(contentPart.content)
              ).length;
            }
          });
        }
      });
    }
    if (typeof system === "string") {
      tokenCount += enc.encode(system).length;
    } else if (Array.isArray(system)) {
      system.forEach((item) => {
        if (item.type !== "text") return;
        if (typeof item.text === "string") {
          tokenCount += enc.encode(item.text).length;
        } else if (Array.isArray(item.text)) {
          item.text.forEach((textPart) => {
            tokenCount += enc.encode(textPart || "").length;
          });
        }
      });
    }
    if (tools) {
      tools.forEach((tool) => {
        if (tool.description) {
          tokenCount += enc.encode(tool.name + tool.description).length;
        }
        if (tool.input_schema) {
          tokenCount += enc.encode(JSON.stringify(tool.input_schema)).length;
        }
      });
    }
    const model = getUseModel(req, tokenCount, config);
    req.body.model = model;
  } catch (error: any) {
    log("Error in router middleware:", error.message);
    req.body.model = config.Router!.default;
  }
  return;
};



================================================
FILE: src/utils/status.ts
================================================
import { getServiceInfo } from './processCheck';

export function showStatus() {
    const info = getServiceInfo();
    
    console.log('\n📊 Claude Code Router Status');
    console.log('═'.repeat(40));
    
    if (info.running) {
        console.log('✅ Status: Running');
        console.log(`🆔 Process ID: ${info.pid}`);
        console.log(`🌐 Port: ${info.port}`);
        console.log(`📡 API Endpoint: ${info.endpoint}`);
        console.log(`📄 PID File: ${info.pidFile}`);
        console.log('');
        console.log('🚀 Ready to use! Run the following commands:');
        console.log('   ccr code    # Start coding with Claude');
        console.log('   ccr stop   # Stop the service');
    } else {
        console.log('❌ Status: Not Running');
        console.log('');
        console.log('💡 To start the service:');
        console.log('   ccr start');
    }
    
    console.log('');
}

