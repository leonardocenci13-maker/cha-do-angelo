# 🧸 Chá do Ângelo — Lista de Presentes

Site de lista de presentes para chá de fraldas, com:
- Login com Google
- **Área dos pais**: cadastrar, editar e excluir presentes
- **Área dos convidados**: ver os presentes, confirmar "vou dar esse presente", com opção de deixar público ou anônimo
- **Presentes em grupo**: um mesmo presente pode ser dividido entre vários convidados (ex: 4 pacotes de fralda, cada um dá 1)

O site é 100% estático (HTML/CSS/JS puro) e usa o **Firebase** (gratuito) como backend para login e banco de dados, então pode ser publicado direto no **GitHub Pages**.

---

## 1. Criar o projeto no Firebase (gratuito, ~5 min)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto novo (ex: `cha-do-angelo`).
2. No menu lateral, vá em **Build → Authentication → Get started**. Na aba "Sign-in method", habilite o provedor **Google**.
3. Vá em **Build → Firestore Database → Create database**. Escolha o modo **produção** e a região mais próxima (ex: `southamerica-east1`).
4. Vá em **Configurações do projeto** (ícone de engrenagem) → aba **Geral** → role até "Seus apps" → clique no ícone `</>` (Web) → registre um app (ex: "cha-do-angelo-web").
5. Copie o objeto `firebaseConfig` que aparece e cole em `js/firebase-config.js`, substituindo os valores de exemplo.
6. Ainda em `js/firebase-config.js`, preencha `ADMIN_EMAILS` com os e-mails do Google **dos pais** (quem poderá cadastrar presentes). Precisa ser o e-mail exato usado no login.

## 2. Configurar as regras de segurança do Firestore

No Firebase Console, vá em **Firestore Database → Regras** e cole (ajustando a lista de e-mails para ser igual à de `firebase-config.js`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null && request.auth.token.email in [
        'mae.do.angelo@gmail.com',
        'pai.do.angelo@gmail.com'
      ];
    }

    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /claims/{claimId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
                             && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null
                    && (resource.data.uid == request.auth.uid || isAdmin());
    }
  }
}
```

Clique em **Publicar**.

> Isso garante que só os pais consigam cadastrar/editar presentes, e que cada convidado só consiga criar, editar ou apagar a **sua própria** confirmação de presente (não a dos outros).

## 3. Autorizar o domínio do GitHub Pages no login do Google

No Firebase Console: **Authentication → Settings → Authorized domains → Add domain**, e adicione o domínio onde o site vai ficar, por exemplo:

```
seu-usuario.github.io
```

## 4. Subir para o GitHub

```bash
git init
git add .
git commit -m "Site do Chá do Ângelo"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/cha-do-angelo.git
git push -u origin main
```

## 5. Ativar o GitHub Pages

No repositório: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"** → Branch: `main` / pasta `/ (root)` → **Save**.

Em alguns minutos o site estará em:
`https://SEU-USUARIO.github.io/cha-do-angelo/`

Compartilhe esse link com os convidados! 🎉

---

## Estrutura de arquivos

```
cha-do-angelo/
├── index.html          → estrutura da página
├── css/style.css        → visual (tema verde sálvia / urso / avião)
├── js/firebase-config.js → SUAS chaves do Firebase (edite aqui)
└── js/app.js            → toda a lógica (login, presentes, confirmações)
```

## Como funciona por dentro

- **Coleção `products`**: cada presente cadastrado pelos pais (`name`, `description`, `link`, `imageUrl`, `groupAllowed`, `quantityNeeded`).
- **Coleção `claims`**: cada confirmação de um convidado (`productId`, `uid`, `name`, `email`, `quantity`, `public`). O id do documento é `productId_uid`, então cada pessoa só pode ter **uma** confirmação por presente (mas pode editar a quantidade se o presente for em grupo).
- Presentes marcados como **"pode ser em grupo"** mostram uma barra de progresso (ex: 2 de 4 confirmados) e aceitam várias pessoas até bater a quantidade necessária — mesmo depois de "completo", alguém ainda pode confirmar se quiser ajudar mesmo assim.
- O campo **"Mostrar meu nome"** controla se o nome aparece para os *outros convidados*. Os **pais (admins) sempre veem todos os nomes**, mesmo os marcados como anônimos — assim eles não recebem presentes duplicados.

## Personalizar o visual

As cores estão no topo de `css/style.css`, em `:root`. Para trocar o tom de verde ou o nome do bebê, edite `index.html` (título) e as variáveis de cor no CSS.

## Custos

O plano gratuito (Spark) do Firebase cobre folgadamente o uso de um chá de bebê (login + poucas dezenas de presentes/confirmações). Não é necessário cartão de crédito.
