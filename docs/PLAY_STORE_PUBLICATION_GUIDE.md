# Guia Oficial de Publicação & Assinatura na Google Play Store
## Aplicativo: BookNook (`com.booknookapp`)

Este guia detalha o fluxo de compilação, validação, rotação de chaves de assinatura e publicação do arquivo **`booknook.aab`** no Google Play Console.

---

## 1. Identidade e Especificações Técnicas Oficiais

| Parâmetro | Valor Configurado |
| :--- | :--- |
| **Nome Oficial do App** | `BookNook` |
| **Application ID / Package Name** | `com.booknookapp` |
| **Versão / VersionCode** | `17` (1.0.17) |
| **SDK Mínimo (minSdkVersion)** | `24` (Android 7.0+) |
| **SDK de Destino (targetSdkVersion)** | `36` (Android 16 / Compatibilidade total) |
| **Tráfego Seguro (HTTPS)** | `usesCleartextTraffic="false"` (100% criptografado) |
| **Permissões de Armazenamento** | **Zero permissões obsoletas** (sem `READ_EXTERNAL_STORAGE` ou `WRITE_EXTERNAL_STORAGE`). O app utiliza o moderno **Storage Access Framework (SAF)** via `ACTION_CREATE_DOCUMENT` para exportar backups com segurança e sem alertas de Scoped Storage no Google Play Console. |

---

## 2. Assinatura de Código e Credenciais

### Chave de Produção Local Atual
O pacote é assinado via `jarsigner` e `apksigner` com algoritmo `SHA256withRSA` e carimbo de data/hora (Timestamp RFC 3161):
* **Arquivo padrão:** `booknook-release-key.jks`
* **Alias padrão:** `booknook`
* **Senha padrão:** `booknook123`

### Impressões Digitais (Fingerprints) do Certificado:
* **SHA-1:** `E3:94:F7:44:A0:27:1C:34:9D:A5:3B:EB:BF:0E:8A:8C:99:C1:CE:E7`
* **SHA-256:** `62:FB:C4:A3:F4:04:CD:84:E8:5C:37:06:F5:57:4C:B1:EF:48:79:02:00:92:F0:8A:E2:11:68:47:B2:61:E3:EF`

---

## 3. Variáveis de Ambiente para CI/CD e Construção Segura

Para não expor a chave ou senhas em repositórios públicos, as rotinas aceitam variáveis de ambiente:

```bash
export ANDROID_KEYSTORE_PATH="/caminho/para/seu/arquivo.jks"
export ANDROID_KEYSTORE_PASSWORD="sua_senha_secreta"
export ANDROID_KEY_ALIAS="booknook"
```

No PowerShell (Windows):
```powershell
$env:ANDROID_KEYSTORE_PATH = "booknook-release-key.jks"
$env:ANDROID_KEYSTORE_PASSWORD = "sua_senha_secreta"
$env:ANDROID_KEY_ALIAS = "booknook"
```

Se as variáveis não forem informadas no ambiente de compilação, o script utiliza automaticamente o fallback seguro local para o arquivo `booknook-release-key.jks`.

---

## 4. Como Compilar os Pacotes Oficiais

### Gerar o Android App Bundle (`booknook.aab`) para a Google Play:
```bash
npm run build:aab
```
Este script:
1. Compila o frontend React/Vite otimizado.
2. Gera o manifesto e recursos compilados em Protobuf via `aapt2`.
3. Compila a camada Java e gera o `classes.dex` via `d8`.
4. Empacota o bundle via `bundletool`.
5. Assina com `jarsigner` (SHA256withRSA + timestamp).
6. Valida com `jarsigner -verify` e `bundletool validate`.
7. Gera o APK Universal de teste via `bundletool build-apks`.

### Gerar o APK direto para testes no celular:
```bash
npm run build:apk
```

---

## 5. Rotação de Chaves no Google Play App Signing

A Google Play gerencia a entrega final dos APKs aos usuários utilizando o serviço **Google Play App Signing**. 

### Cenário A: Se a Google Play pedir a mesma chave de upload
1. Acesse o **Google Play Console** > Seu Aplicativo > **Versão** > **Integridade do app**.
2. Compare o SHA-1 e SHA-256 do painel com os fingerprints informados na Seção 2:
   - `SHA-1: E3:94:F7:44:A0:27:1C:34:9D:A5:3B:EB:BF:0E:8A:8C:99:C1:CE:E7`
3. Se coincidirem, basta fazer o upload direto do arquivo `booknook.aab`.

### Cenário B: Se você perdeu a chave de upload original ou precisa redefini-la
O Google Play Console permite redefinir a chave de upload a qualquer momento sem perder seus usuários:
1. No **Google Play Console**, vá em **Versão** > **Integridade do app** > **Chave de upload**.
2. Clique em **Solicitar redefinição da chave de upload**.
3. Selecione o motivo (ex: "Perdi a chave de upload").
4. Gere um novo arquivo de certificado público (`.pem`):
   ```bash
   keytool -export -rfc -keystore booknook-release-key.jks -alias booknook -file upload_certificate.pem
   ```
5. Envie o arquivo `upload_certificate.pem` no formulário do Google Play Console.
6. A Google Play aprova a nova chave de upload em até 24-48 horas, e a partir de então todos os novos arquivos `.aab` assinados com essa chave serão aceitos normalmente.

---

## 6. Checklist de Conformidade do Google Play Console
- [x] **Package Name Unificado:** `com.booknookapp`
- [x] **App Name:** `BookNook`
- [x] **Target SDK:** 36 (Totalmente compatível com a exigência anual de SDK do Google Play)
- [x] **Min SDK:** 24 (Compatível com 99%+ dos dispositivos ativos)
- [x] **Zero permissões de armazenamento sensíveis:** Sem necessidade de declaração especial de "All Files Access" / `MANAGE_EXTERNAL_STORAGE`.
- [x] **Tráfego Seguro Obrigatório:** `usesCleartextTraffic="false"` ativado.
- [x] **Segurança do Servidor Backend:** Proteção contra SSRF na busca de capas, sanitização de requisições e rate limiting preventivo ativados.
- [x] **Integridade de Dados:** Migração de dados do usuário 100% preservada com backup preventivo automático antes de qualquer atualização.
