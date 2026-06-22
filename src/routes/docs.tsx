import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Loops · Developer Docs" },
      {
        name: "description",
        content:
          "Use Loops from any language: REST API, embed widget, webhooks (Discord/Slack), and a Discord bot example.",
      },
      { property: "og:title", content: "Loops · Developer Docs" },
      {
        property: "og:description",
        content: "REST API + embed widget + bot templates. Open source, MIT.",
      },
    ],
  }),
  component: DocsPage,
});

// Two tabs, Canny-style: Install (how to use it) and API (reference).
const INSTALL_IDS = ["quickstart", "multiboard", "embed", "identify", "mobile", "discord"] as const;
const API_IDS = ["intro", "posts", "webhooks"] as const;
const SECTION_HASH: Record<string, string> = {
  quickstart: "quickstart",
  multiboard: "multiboard",
  embed: "embed",
  identify: "identify",
  mobile: "mobile",
  discord: "bot-discord",
  intro: "api-intro",
  posts: "api-posts",
  votes: "api-votes",
  webhooks: "webhooks",
};

// ─── local i18n dictionary for the docs body ────────────────────────
type DocsCopy = typeof DOCS_TR;
const DOCS_TR = {
  quickstart: {
    eyebrow: "3 dakika",
    title: "Hızlı başla",
    step1a: "Giriş yap / kayıt ol",
    step1b: ", sonra panonu oluştur (her ürün için ayrı bir pano açabilirsin).",
    step2a: "Panonun Ayarlar → API Anahtarları",
    step2b: " sayfasında bir ",
    step2c: " ya da ",
    step2d: " anahtar oluştur. Her pano kendi anahtarlarına sahiptir.",
    step3: "API'yi o panonun anahtarıyla cURL ile dene:",
  },
  multiboard: {
    eyebrow: "Çoklu ürün",
    title: "Birden çok pano",
    lead: "Her ürün/uygulaman için ayrı bir pano oluştur. Panolar tamamen bağımsızdır — kendi postları, üyeleri, AI anahtarı ve API anahtarları olur. 5 uygulaman varsa 5 pano açar, her birini kendi anahtarıyla ilgili uygulamaya gömersin.",
    steps: [
      "Her ürün için bir pano aç: getloops.co/acme-web, getloops.co/acme-mobil, …",
      "Her panonun Ayarlar → API Anahtarları'ndan kendi publishable (widget) ve secret (REST) anahtarını al.",
      "İlgili uygulamanın içine o panonun anahtarıyla widget'ı göm veya REST API'yi kullan. Her uygulama yalnızca kendi panosunu görür.",
    ],
    exampleTitle: "Örnek: iki ürün, iki ayrı pano",
  },
  embed: {
    eyebrow: "HTML",
    title: "Embed widget",
    lead: "Herhangi bir HTML sayfasına tek satırla geri bildirim board'u ekle. Vanilla JS, ~8KB, bağımlılıksız.",
    bullets: [
      ["data-key", ": publishable key (loop_pk_…). Secret key'i tarayıcıya koyma."],
      ["data-theme", ": light veya dark."],
      ["data-locale", ": tr veya en."],
      ["data-target", ": widget'ın gömüleceği CSS selector."],
      [
        "data-user-id",
        ": uygulamandaki giriş yapmış kullanıcının id'si — oy/öneri o kullanıcıya bağlanır (cihazlar arası tekil). Boş bırakırsan misafir.",
      ],
    ] as Array<[string, string]>,
  },
  identify: {
    eyebrow: "Kullanıcılar",
    title: "Kullanıcı tanımlama",
    lead: "Oyları ve önerileri uygulamandaki gerçek kullanıcıya bağla. Tanımlanan kullanıcı cihaz değiştirse bile tek oy hakkına sahip olur; tanımlamazsan ziyaretçi misafir (tarayıcı/IP) olarak sayılır.",
    webTitle: "Web (widget)",
    webDesc: "Widget script'ine giriş yapmış kullanıcının id'sini ver:",
    apiTitle: "API / sunucu",
    apiDesc:
      "REST API'de her oy/öneride external_user_id (ya da oy için X-Loop-External-User header'ı) geç. Aynı id = aynı kullanıcı.",
    note: "İpucu: external_user_id olarak kendi veritabanındaki kullanıcı id'sini kullan. Anonim ziyaretçi için tarayıcıda kalıcı bir id üretip hep onu gönder.",
  },
  mobile: {
    eyebrow: "iOS / Android",
    title: "Mobil",
    lead: "Native uygulamada iki yol var:",
    webviewTitle: "1) WebView (en hızlı)",
    webviewDesc:
      "Panonu (veya widget'ı) bir WebView'da aç — kod yazmadan tam çalışır. Giriş yapmış kullanıcı için URL'e ?u=<user_id> ekleyip widget'ta data-user-id olarak kullanabilirsin.",
    apiTitle: "2) Native + REST API",
    apiDesc:
      "Kendi native ekranını çiz, listeleme/oy/öneri için REST API'yi çağır ve external_user_id olarak uygulamandaki kullanıcı id'sini gönder (gizli anahtarı uygulamaya gömme — backend üzerinden geç).",
  },
  api: {
    eyebrow: "Bearer auth",
    title: "REST API",
    leadA: "Tüm endpoint'ler JSON. CORS açık. Her istekte ",
    leadB: " bekler. Hatalar ",
    leadC: " formatında döner.",
    scopesTitle: "Anahtarlar & scope'lar",
    scopes:
      "secret anahtar (loop_sk_) sunucu içindir, read/write/admin scope'larını taşır. publishable anahtar (loop_pk_) tarayıcı/widget içindir (read + oy/öneri). Listeleme read, post/oy write, durum/etiket/silme admin ister.",
    responseTitle: "Yanıt şekli",
    endpoints: {
      list: {
        desc: "Tüm geri bildirimleri listele.",
        params: {
          status: "planned | progress | done",
          tag: "etiketle filtrele",
          limit: "varsayılan 50, max 200",
          offset: "sayfalama için",
        },
      },
      create: {
        desc: "Yeni post oluştur (write scope).",
        params: {
          title: "zorunlu",
          description: "opsiyonel",
          tag: "opsiyonel",
          external: "anonim kullanıcı kimliği (bot/embed için)",
          source: "örn: embed, mobile, crm",
        },
      },
      vote: {
        desc: "Bir post'a oy ver/kaldır (toggle).",
        external: "anonim kullanıcı kimliği, zorunlu",
      },
      update: {
        desc: "Post durumunu/etiketini güncelle (admin scope).",
        status: "planned | progress | done",
        tag: "yeni etiket",
      },
      remove: {
        desc: "Post'u sil (admin scope).",
      },
      comments: { desc: "Bir post'un yorumlarını listele." },
      changelog: { desc: "Yayınlanan (done) öğeler, en yeni önce." },
      board: { desc: "Pano bilgisi + durum sayıları (planned/progress/done)." },
      tags: { desc: "Panodaki etiketler ve post adetleri." },
    },
  },
  webhooks: {
    eyebrow: "Outgoing",
    title: "Webhooks",
    leadA:
      "Loops'ta yeni post / oy / durum değişimi olduğunda kendi URL'ne POST atılır. Bir Discord veya Slack webhook URL'i eklersen mesaj otomatik o platformun formatında gönderilir — ekstra kod/relay gerekmez. Diğer her şey (Linear, GitHub Issues, kendi sunucun) imzalı genel JSON alır.",
    leadB1: "Her istek ",
    leadB2: " header'ı taşır: webhook gizli anahtarınla ",
    leadB3: ". Aşağıda Node ile doğrulama:",
    payload: "Webhook payload örneği: ",
  },
  discord: {
    eyebrow: "Node + discord.js",
    title: "Discord bot",
    leadA: "",
    leadB: " slash komutuyla Loops'a post yollayan minimal bot.",
    cmd: "/feedback",
  },
};

const DOCS_EN: DocsCopy = {
  quickstart: {
    eyebrow: "3 minutes",
    title: "Quick start",
    step1a: "Sign in / sign up",
    step1b: ", then create your board (you can make a separate board per product).",
    step2a: "your board's Settings → API Keys",
    step2b: " page, create a ",
    step2c: " or ",
    step2d: " key. Each board has its own keys.",
    step3: "Try the API with that board's key via cURL:",
  },
  multiboard: {
    eyebrow: "Multiple products",
    title: "Multiple boards",
    lead: "Create a separate board for each product/app. Boards are fully independent — each has its own posts, members, AI key and API keys. Got 5 apps? Make 5 boards and embed each one with its own key.",
    steps: [
      "Create one board per product: getloops.co/acme-web, getloops.co/acme-mobile, …",
      "Grab each board's own publishable (widget) and secret (REST) key from its Settings → API Keys.",
      "Embed the widget — or call the REST API — in each app with that board's key. Each app only ever sees its own board.",
    ],
    exampleTitle: "Example: two products, two separate boards",
  },
  embed: {
    eyebrow: "HTML",
    title: "Embed widget",
    lead: "Drop a feedback board into any HTML page with a single line. Vanilla JS, ~8KB, no dependencies.",
    bullets: [
      ["data-key", ": publishable key (loop_pk_…). Never put a secret key in the browser."],
      ["data-theme", ": light or dark."],
      ["data-locale", ": tr or en."],
      ["data-target", ": CSS selector where the widget mounts."],
      [
        "data-user-id",
        ": your logged-in user's id — ties votes/posts to that user (deduped across devices). Omit for anonymous guests.",
      ],
    ],
  },
  identify: {
    eyebrow: "Users",
    title: "Identify users",
    lead: "Tie votes and posts to the real user in your app. An identified user gets one vote even across devices; without it, visitors are counted as guests (browser/IP).",
    webTitle: "Web (widget)",
    webDesc: "Pass your logged-in user's id to the widget script:",
    apiTitle: "API / server",
    apiDesc:
      "On the REST API, send external_user_id (or the X-Loop-External-User header for votes) on every vote/post. Same id = same user.",
    note: "Tip: use your own database user id as external_user_id. For anonymous visitors, generate a persistent id in the browser and always send the same one.",
  },
  mobile: {
    eyebrow: "iOS / Android",
    title: "Mobile",
    lead: "Two ways to use Loops in a native app:",
    webviewTitle: "1) WebView (fastest)",
    webviewDesc:
      "Open your board (or the widget) in a WebView — works fully with no code. For a logged-in user, append ?u=<user_id> and pass it to the widget's data-user-id.",
    apiTitle: "2) Native + REST API",
    apiDesc:
      "Build your own native screen and call the REST API for listing/voting/posting, sending your app's user id as external_user_id (never embed a secret key in the app — proxy through your backend).",
  },
  api: {
    eyebrow: "Bearer auth",
    title: "REST API",
    leadA: "All endpoints are JSON. CORS is open. Every request needs ",
    leadB: ". Errors come back as ",
    leadC: ".",
    scopesTitle: "Keys & scopes",
    scopes:
      "A secret key (loop_sk_) is for your server and carries read/write/admin scopes. A publishable key (loop_pk_) is for the browser/widget (read + vote/post). Listing needs read, posting/voting needs write, status/tag/delete needs admin.",
    responseTitle: "Response shape",
    endpoints: {
      list: {
        desc: "List all feedback items.",
        params: {
          status: "planned | progress | done",
          tag: "filter by tag",
          limit: "default 50, max 200",
          offset: "for pagination",
        },
      },
      create: {
        desc: "Create a new post (write scope).",
        params: {
          title: "required",
          description: "optional",
          tag: "optional",
          external: "anonymous user id (for bots/embed)",
          source: "e.g. embed, mobile, crm",
        },
      },
      vote: {
        desc: "Vote / unvote on a post (toggle).",
        external: "anonymous user id, required",
      },
      update: {
        desc: "Update a post's status/tag (admin scope).",
        status: "planned | progress | done",
        tag: "new tag",
      },
      remove: {
        desc: "Delete a post (admin scope).",
      },
      comments: { desc: "List a post's comments." },
      changelog: { desc: "Shipped (done) items, newest first." },
      board: { desc: "Board info + status counts (planned/progress/done)." },
      tags: { desc: "Tags used on the board, with post counts." },
    },
  },
  webhooks: {
    eyebrow: "Outgoing",
    title: "Webhooks",
    leadA:
      "When a new post / vote / status change happens in Loops, we POST to your URL. Paste a Discord or Slack incoming-webhook URL and we format the message for that platform automatically — no relay needed. Everything else (Linear, GitHub Issues, your own server) gets the signed generic JSON.",
    leadB1: "Every request carries an ",
    leadB2: " header — your webhook secret signed with ",
    leadB3: ". Node verification example below:",
    payload: "Sample webhook payload: ",
  },
  discord: {
    eyebrow: "Node + discord.js",
    title: "Discord bot",
    leadA: "Minimal bot that posts to Loops via the ",
    leadB: " slash command.",
    cmd: "/feedback",
  },
};

function useDocsCopy(): DocsCopy {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith("en") ? DOCS_EN : DOCS_TR;
}

function DocsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"install" | "api">("install");
  const ids = tab === "install" ? INSTALL_IDS : API_IDS;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-10">
        <aside className="lg:sticky lg:top-24 self-start">
          {/* Install / API tabs */}
          <div className="flex gap-1 rounded-full border border-border bg-surface p-1 text-sm mb-4">
            {(["install", "api"] as const).map((tk) => (
              <button
                key={tk}
                onClick={() => setTab(tk)}
                className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${
                  tab === tk
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`docs.tabs.${tk}`)}
              </button>
            ))}
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {ids.map((id) => (
              <a
                key={id}
                href={`#${SECTION_HASH[id]}`}
                className="text-sm text-muted-foreground hover:text-foreground py-1.5 px-2 rounded-md hover:bg-secondary whitespace-nowrap"
              >
                {t(`docs.sections.${id}`)}
              </a>
            ))}
          </nav>
          <div className="hidden lg:block mt-8 rounded-2xl border border-border bg-surface p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{t("docs.licenseTitle")}</p>
            <p>{t("docs.licenseDesc")}</p>
          </div>
        </aside>

        <main className="min-w-0 space-y-20">
          {tab === "install" ? (
            <>
              <Hero />
              <Quickstart />
              <MultiBoard />
              <Embed />
              <IdentifyUsers />
              <Mobile />
              <BotDiscord />
            </>
          ) : (
            <>
              <ApiIntro />
              <ApiPosts />
              <Webhooks />
            </>
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section>
      <h1 className="font-display text-5xl font-medium tracking-tight">{t("docs.heroTitle")}</h1>
      <p className="text-lg text-muted-foreground mt-3 max-w-2xl">{t("docs.heroLead")}</p>
      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        {["REST API", "Webhooks", "JS Widget", "Bot templates", "Self-hosted"].map((tag) => (
          <span key={tag} className="rounded-full bg-secondary text-muted-foreground px-3 py-1">
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function Quickstart() {
  const c = useDocsCopy().quickstart;
  return (
    <Section id="quickstart" title={c.title} eyebrow={c.eyebrow}>
      <ol className="space-y-4 text-sm">
        <Step n={1}>
          <Link to="/auth" className="text-foreground underline underline-offset-4">
            {c.step1a}
          </Link>
          {c.step1b}
        </Step>
        <Step n={2}>
          <Link to="/dashboard" className="text-foreground underline underline-offset-4">
            {c.step2a}
          </Link>
          {c.step2b}
          <em>secret</em>
          {c.step2c}
          <em>publishable</em>
          {c.step2d}
        </Step>
        <Step n={3}>
          {c.step3}
          <Code language="bash">{`curl -H "Authorization: Bearer loop_sk_..." \\
  https://getloops.co/api/v1/posts`}</Code>
        </Step>
      </ol>
    </Section>
  );
}

function MultiBoard() {
  const c = useDocsCopy().multiboard;
  return (
    <Section id="multiboard" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-4">{c.lead}</p>
      <ol className="space-y-3 text-sm mb-4">
        {c.steps.map((s, i) => (
          <Step key={i} n={i + 1}>
            {s}
          </Step>
        ))}
      </ol>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {c.exampleTitle}
      </p>
      <Code language="html">{`<!-- Product A → board "acme-web" -->
<div id="loop-web"></div>
<script src="https://getloops.co/loop-widget.js"
        data-key="loop_pk_WEB_..."
        data-target="#loop-web"></script>

<!-- Product B → board "acme-mobile" -->
<div id="loop-mobile"></div>
<script src="https://getloops.co/loop-widget.js"
        data-key="loop_pk_MOBILE_..."
        data-target="#loop-mobile"></script>`}</Code>
    </Section>
  );
}

function Embed() {
  const c = useDocsCopy().embed;
  return (
    <Section id="embed" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-4">{c.lead}</p>
      <Code language="html">{`<div id="loop-board"></div>
<script src="https://getloops.co/loop-widget.js"
        data-key="loop_pk_..."
        data-host="https://getloops.co"
        data-target="#loop-board"
        data-theme="light"
        data-locale="tr"
        data-user-id="user_42"></script>  <!-- optional: your logged-in user -->`}</Code>
      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        {c.bullets.map(([k, v]) => (
          <P key={k}>
            <strong className="text-foreground">{k}</strong>
            {v}
          </P>
        ))}
      </div>
    </Section>
  );
}

function IdentifyUsers() {
  const c = useDocsCopy().identify;
  return (
    <Section id="identify" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-5">{c.lead}</p>

      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{c.webTitle}</p>
      <p className="text-sm text-muted-foreground mb-2">{c.webDesc}</p>
      <Code language="html">{`<script src="https://getloops.co/loop-widget.js"
        data-key="loop_pk_..."
        data-user-id="user_42"
        data-target="#loop-board"></script>`}</Code>

      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 mt-6">
        {c.apiTitle}
      </p>
      <p className="text-sm text-muted-foreground mb-2">{c.apiDesc}</p>
      <Code language="bash">{`curl -X POST -H "Authorization: Bearer loop_sk_..." \\
  -H "X-Loop-External-User: user_42" \\
  https://getloops.co/api/v1/posts/POST_ID/vote`}</Code>

      <p className="mt-4 text-xs text-muted-foreground">{c.note}</p>
    </Section>
  );
}

function Mobile() {
  const c = useDocsCopy().mobile;
  return (
    <Section id="mobile" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-5">{c.lead}</p>

      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {c.webviewTitle}
      </p>
      <p className="text-sm text-muted-foreground mb-2">{c.webviewDesc}</p>
      <Code language="swift">{`// iOS — WKWebView
let url = URL(string: "https://getloops.co/acme")!
webView.load(URLRequest(url: url))

// Android — WebView
webView.loadUrl("https://getloops.co/acme")`}</Code>

      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 mt-6">
        {c.apiTitle}
      </p>
      <p className="text-sm text-muted-foreground">{c.apiDesc}</p>
    </Section>
  );
}

function ApiIntro() {
  const c = useDocsCopy().api;
  return (
    <Section id="api-intro" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-4">
        {c.leadA}
        <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">
          Authorization: Bearer &lt;key&gt;
        </code>
        {c.leadB}
        <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{`{ error: { code, message } }`}</code>
        {c.leadC}
      </p>

      <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">{c.scopesTitle}: </strong>
        {c.scopes}
      </div>

      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {c.responseTitle}
      </p>
      <Code language="json">{`{
  "data": [
    {
      "id": "b1a2…",
      "title": "Dark mode",
      "description": "…",
      "tag": "UI",
      "status": "planned",
      "votes_count": 42,
      "created_at": "2026-06-22T12:00:00Z"
    }
  ]
}`}</Code>
    </Section>
  );
}

function ApiPosts() {
  const c = useDocsCopy().api;
  const { t } = useTranslation();
  return (
    <Section id="api-posts" title={t("docs.sections.posts")} eyebrow="/api/v1/posts">
      <Endpoint method="GET" path="/api/v1/posts" desc={c.endpoints.list.desc}>
        <ParamRow name="status" type="query" desc={c.endpoints.list.params.status} />
        <ParamRow name="tag" type="query" desc={c.endpoints.list.params.tag} />
        <ParamRow name="limit" type="query" desc={c.endpoints.list.params.limit} />
        <ParamRow name="offset" type="query" desc={c.endpoints.list.params.offset} />
        <LangTabs
          samples={{
            curl: `curl -H "Authorization: Bearer loop_sk_..." \\
  "https://getloops.co/api/v1/posts?status=planned&limit=10"`,
            js: `const res = await fetch("https://getloops.co/api/v1/posts?limit=10", {
  headers: { Authorization: "Bearer loop_sk_..." }
});
const { data } = await res.json();`,
            python: `import requests
r = requests.get(
  "https://getloops.co/api/v1/posts",
  headers={"Authorization": "Bearer loop_sk_..."},
  params={"limit": 10},
)
print(r.json()["data"])`,
            php: `$ch = curl_init("https://getloops.co/api/v1/posts");
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => ["Authorization: Bearer loop_sk_..."],
  CURLOPT_RETURNTRANSFER => true,
]);
$data = json_decode(curl_exec($ch), true)["data"];`,
            go: `req, _ := http.NewRequest("GET", "https://getloops.co/api/v1/posts", nil)
req.Header.Set("Authorization", "Bearer loop_sk_...")
resp, _ := http.DefaultClient.Do(req)`,
          }}
        />
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/posts" desc={c.endpoints.create.desc}>
        <ParamRow name="title" type="body (string, 3-140)" desc={c.endpoints.create.params.title} />
        <ParamRow
          name="description"
          type="body (string)"
          desc={c.endpoints.create.params.description}
        />
        <ParamRow name="tag" type="body (string)" desc={c.endpoints.create.params.tag} />
        <ParamRow
          name="external_user_id"
          type="body (string)"
          desc={c.endpoints.create.params.external}
        />
        <ParamRow name="source" type="body (string)" desc={c.endpoints.create.params.source} />
        <LangTabs
          samples={{
            curl: `curl -X POST -H "Authorization: Bearer loop_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Dark theme please","tag":"UI","source":"crm"}' \\
  https://getloops.co/api/v1/posts`,
            js: `await fetch("https://getloops.co/api/v1/posts", {
  method: "POST",
  headers: {
    Authorization: "Bearer loop_sk_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ title: "Dark theme please", tag: "UI" }),
});`,
            python: `requests.post(
  "https://getloops.co/api/v1/posts",
  headers={"Authorization": "Bearer loop_sk_..."},
  json={"title": "Dark theme", "tag": "UI", "source": "py-script"},
)`,
            php: `$payload = json_encode(["title" => "Dark theme", "tag" => "UI"]);
$ch = curl_init("https://getloops.co/api/v1/posts");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer loop_sk_...",
    "Content-Type: application/json",
  ],
]);
curl_exec($ch);`,
            go: `body := strings.NewReader(\`{"title":"Dark theme","tag":"UI"}\`)
req, _ := http.NewRequest("POST", "https://getloops.co/api/v1/posts", body)
req.Header.Set("Authorization", "Bearer loop_sk_...")
req.Header.Set("Content-Type", "application/json")
http.DefaultClient.Do(req)`,
          }}
        />
      </Endpoint>

      <Endpoint method="POST" path="/api/v1/posts/:id/vote" desc={c.endpoints.vote.desc}>
        <ParamRow
          name="external_user_id"
          type="body / X-Loop-External-User header"
          desc={c.endpoints.vote.external}
        />
        <LangTabs
          samples={{
            curl: `curl -X POST -H "Authorization: Bearer loop_pk_..." \\
  -H "X-Loop-External-User: tg_user_12345" \\
  https://getloops.co/api/v1/posts/POST_ID/vote`,
            js: `await fetch(\`https://getloops.co/api/v1/posts/\${id}/vote\`, {
  method: "POST",
  headers: {
    Authorization: "Bearer loop_pk_...",
    "X-Loop-External-User": userId,
  },
});`,
            python: `requests.post(
  f"https://getloops.co/api/v1/posts/{post_id}/vote",
  headers={
    "Authorization": "Bearer loop_pk_...",
    "X-Loop-External-User": str(user_id),
  },
)`,
            php: `$ch = curl_init("https://getloops.co/api/v1/posts/$id/vote");
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_POSTFIELDS => "",
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer loop_pk_...",
    "X-Loop-External-User: $userId",
  ],
]);
curl_exec($ch);`,
            go: `req, _ := http.NewRequest("POST", fmt.Sprintf("https://getloops.co/api/v1/posts/%s/vote", id), nil)
req.Header.Set("Authorization", "Bearer loop_pk_...")
req.Header.Set("X-Loop-External-User", userId)
http.DefaultClient.Do(req)`,
          }}
        />
      </Endpoint>

      <Endpoint method="PATCH" path="/api/v1/posts/:id" desc={c.endpoints.update.desc}>
        <ParamRow name="status" type="body" desc={c.endpoints.update.status} />
        <ParamRow name="tag" type="body" desc={c.endpoints.update.tag} />
      </Endpoint>

      <Endpoint method="DELETE" path="/api/v1/posts/:id" desc={c.endpoints.remove.desc} />

      <Endpoint method="GET" path="/api/v1/posts/:id/comments" desc={c.endpoints.comments.desc}>
        <Code language="bash">{`curl -H "Authorization: Bearer loop_sk_..." \\
  https://getloops.co/api/v1/posts/POST_ID/comments`}</Code>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/changelog" desc={c.endpoints.changelog.desc}>
        <Code language="bash">{`curl -H "Authorization: Bearer loop_sk_..." \\
  "https://getloops.co/api/v1/changelog?limit=20"`}</Code>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/board" desc={c.endpoints.board.desc}>
        <Code language="bash">{`curl -H "Authorization: Bearer loop_sk_..." \\
  https://getloops.co/api/v1/board`}</Code>
      </Endpoint>

      <Endpoint method="GET" path="/api/v1/tags" desc={c.endpoints.tags.desc}>
        <Code language="bash">{`curl -H "Authorization: Bearer loop_sk_..." \\
  https://getloops.co/api/v1/tags`}</Code>
      </Endpoint>
    </Section>
  );
}

function Webhooks() {
  const c = useDocsCopy().webhooks;
  return (
    <Section id="webhooks" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-4">{c.leadA}</p>
      <p className="text-sm text-muted-foreground mb-4">
        {c.leadB1}
        <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">X-Loop-Signature</code>
        {c.leadB2}
        <code>HMAC-SHA256(body)</code>
        {c.leadB3}
      </p>
      <Code language="js">{`import crypto from "node:crypto";

function verify(req, secret) {
  const sig = req.headers["x-loop-signature"];
  const expected = crypto.createHmac("sha256", secret)
    .update(req.rawBody).digest("hex");
  return sig && crypto.timingSafeEqual(
    Buffer.from(sig), Buffer.from(expected)
  );
}`}</Code>
      <p className="text-xs text-muted-foreground mt-3">
        {c.payload}
        <code className="bg-secondary px-1.5 py-0.5 rounded">{`{ event: "post.created", post: { id, title, ... }, timestamp }`}</code>
      </p>
    </Section>
  );
}

function BotDiscord() {
  const c = useDocsCopy().discord;
  const en = c === DOCS_EN.discord;
  return (
    <Section id="bot-discord" title={c.title} eyebrow={c.eyebrow}>
      <p className="text-sm text-muted-foreground mb-4">
        {en && c.leadA}
        <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{c.cmd}</code>
        {c.leadB}
      </p>
      <Code language="bash">{`npm i discord.js
# Create a bot + applications.commands scope in the Discord Developer Portal`}</Code>
      <Code language="js">{`import {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder,
} from "discord.js";

const cmd = new SlashCommandBuilder()
  .setName("feedback")
  .setDescription("Send feedback to Loops")
  .addStringOption(o => o.setName("text").setDescription("Your idea").setRequired(true));

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.DISCORD_APP_ID),
  { body: [cmd.toJSON()] }
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== "feedback") return;
  const text = i.options.getString("text", true);
  const r = await fetch(\`\${process.env.LOOP_HOST}/api/v1/posts\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.LOOP_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: text.slice(0, 140),
      source: "discord",
      external_user_id: \`dc_\${i.user.id}\`,
      tag: "discord",
    }),
  });
  await i.reply({ content: r.ok ? "✓ Added." : "❌ Error.", ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);`}</Code>
    </Section>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{eyebrow}</p>
      <h2 className="font-display text-3xl font-medium tracking-tight mb-6">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
        {n}
      </span>
      <div className="pt-0.5">{children}</div>
    </li>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-secondary/50 p-2.5 leading-relaxed">{children}</p>;
}

function Code({ children, language }: { children: string; language: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-3">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded">
          {language}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-[10px] uppercase tracking-widest text-muted-foreground bg-background/80 backdrop-blur hover:text-foreground px-2 py-1 rounded"
        >
          {copied ? "✓" : t("common.copy")}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-2xl bg-foreground text-background p-4 pt-10 text-xs leading-relaxed font-mono">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
  children,
}: {
  method: string;
  path: string;
  desc: string;
  children?: React.ReactNode;
}) {
  const methodStyle: Record<string, string> = {
    GET: "bg-status-done/10 text-status-done border-status-done/20",
    POST: "bg-ai/10 text-ai border-ai/20",
    PATCH: "bg-status-progress/10 text-status-progress border-status-progress/20",
    DELETE: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <div className="my-6 rounded-3xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-mono font-semibold ${methodStyle[method]}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono font-medium">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{desc}</p>
      {children}
    </div>
  );
}

function ParamRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 text-xs border-t border-border first:border-t-0">
      <code className="text-foreground font-medium">{name}</code>
      <div>
        <span className="text-muted-foreground">{type}</span>
        <span className="text-muted-foreground"> — {desc}</span>
      </div>
    </div>
  );
}

function LangTabs({ samples }: { samples: Record<string, string> }) {
  const langs = Object.keys(samples);
  const [active, setActive] = useState(langs[0]);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-1 border-b border-border">
        {langs.map((l) => (
          <button
            key={l}
            onClick={() => setActive(l)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              active === l
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <Code language={active}>{samples[active]}</Code>
    </div>
  );
}
