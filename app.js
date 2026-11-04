/* 火星币 铸造页：地址填写 → 链上资格检查 → 生成可粘贴给 AI 代理的指令（支持中英切换） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // 公共节点会间歇性 403，逐个试探
  const RPCS = [
    "https://bsc.rpc.blxrbdn.com",
    "https://bsc-dataseed1.binance.org",
    "https://bsc-dataseed.binance.org",
    "https://bsc.publicnode.com",
    "https://binance.llamarpc.com",
  ];
  const CHAIN_ID = 56;
  const MINT_SIG = "0x836a1040"; // 新版：mint(uint256 shares, address referrer, uint256 maxCost)
  const MINT_SIG_LEGACY = "0x1249c58b"; // 旧版：mint() 无参，一次只能买 1 份

  // ====== 新版本配置（部署后把 CONTRACT 改成真实地址即可，其余已固定）======
  const CONFIG = {
    CONTRACT: "0x8FF00Ab1C7e7C517B99Dd3d689bccee49e61Ac7E",
    USDT: "0x55d398326f99059fF775485246999027B3197955",     // BSC USDT
    AGENT_ID_NFT: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
    BSCSCAN_API_KEY: "", // 留空走链上分段查询；填入 BscScan 免费 API Key 则走 BscScan（更快、不限区块）
  };

  // 推广链接 ?ref=0x... 读取（作为默认推荐人；实际是否生效以链上 isMinted[ref] 为准）
  let defaultReferrer = ethers.ZeroAddress;
  try {
    const _ref = new URLSearchParams(location.search).get("ref");
    if (_ref && ethers.isAddress(_ref)) defaultReferrer = ethers.getAddress(_ref);
  } catch {}

  /* ---------------- 多语言 ---------------- */

  const I18N = {
    zh: {
      "brand.sub": "Agent ID 专属铸造 · BSC",
      "ticker.text": "每份 {price} USDT 换 {perMint} 枚 {sym} · 持有币安 Agent ID 才能铸造 · {cap} 份硬顶 · 买卖 3% 税费（1% 销毁 + 1% 持币分红 USDT + 1% 回流 LP） · 推广一人多 1 份",
      "btn.connect": "连接以验证 ↗",
      "btn.walletMint": "一键铸造（Mint）",
      "wc.hint": "连接持有你 .ai Agent ID 的币安钱包，即可在本页直接铸造（approve + mint 两笔交易）",
      "wc.title": "代理钱包",
      "wc.tip": "连接币安代理钱包以读取此钱包上的 .ai 代理 ID。",
      "wc.badgeConnecting": "连接中",
      "wc.badgeOk": "已连接",
      "wc.pairLabel": "配对码",
      "wc.pairTip": "用币安 App 扫码，确认配对码一致后再确认授权。",
      "wc.afterConfirm": "你确认后，本页会自动切换到你的钱包。",
      "wc.waiting": "正在等待币安 App",
      "wc.regular": "使用普通钱包",
      "wc.noInjected": "没有检测到浏览器钱包插件",
      "wc.openApp": "打开币安登录",
      "wc.openSite": "在币安 App 打开本站",
      "wc.qrModeWc": "用币安 App 扫码，确认配对码一致后授权连接。",
      "wc.badUri": "连接串异常（不是有效的 wc: 连接串），请把下方文字发开发者",
      "wc.qrModeUrl": "用币安 App 扫码 → 在 App 内打开本站 → App 内点「一键铸造」即可（App 内自带币安钱包，无需扫码连接）。",
      "wc.urlQrHint": "WalletConnect 无响应，已改用二维码：用币安 App 扫码打开本站在 App 内铸造。",
      "wc.cancel": "取消连接",
      "wc.notBinance": "检测到非币安钱包（如小狐狸）。本页只连币安钱包：请在币安 App 内打开本站，或安装币安钱包插件，也可用扫码连接。",
      "wc.scanMode": "未检测到币安钱包：点「一键铸造」会弹出二维码，用币安 App 扫码授权后自动完成铸造。",
      "wc.copyLink": "复制本站网址",
      "wc.copyLinkOk": "网址已复制，粘到币安 App 内打开即可直接连钱包铸造",
      "wc.qrReady": "二维码已生成，用币安 App 扫描授权",
      "wc.slowHint": "连接服务迟迟没有响应：多半是 Reown 后台没把本站域名加进 Allowed origins，也可能是网络被限制。可改用「复制本站网址」在币安 App 内打开。",
      "wc.noWay": "此浏览器既没有币安钱包，也无法建立扫码连接。请在币安 App 内打开本站（Web3 钱包 → 发现 → 粘贴网址），或使用「生成 AI 指令」让 AI 代理代铸。",
      "wc.diagTitle": "环境诊断（连不上钱包时点开这里）",
      "wc.diagCopy": "复制诊断信息",
      "wc.diagReload": "重新检测",
      "wc.diagCopied": "诊断信息已复制，贴给开发者定位",
      "wc.relayBlockedShort": "当前网络无法访问 WalletConnect 中继，扫码连接不可用",
      "wc.relayBlocked": "当前网络无法访问 WalletConnect 中继（连接被重置），扫码连接不可用。请二选一：① 在 Chrome 安装<a href='https://chromewebstore.google.com/detail/binance-wallet/cadiboklkpojfamcoggejbbdjcoiljjk' target='_blank' rel='noopener'>币安钱包插件</a>，装好后点「连接币安钱包」直接连（不依赖中继）；② 在币安 App 的 Web3 钱包浏览器里打开本站。也可以用「生成 AI 指令」让 AI 代理代铸。",
      "wc.netTest": "测试连接服务",
      "wc.netTesting": "正在用 WalletConnect 真实握手测试…（最多 20 秒）",
      "wc.netRelayOk": "✓ 中继连接成功（网络没问题）。正在请求配对，验证 projectId…",
      "wc.netDone": "连通性测试完成，结果见下方",
      "wc.connectingFirst": "正在连接币安钱包…",
      "wc.needId": "未配置 WalletConnect projectId，扫码连接不可用",
      "wc.pidSaved": "projectId 已保存",
      "wc.connecting": "正在建立连接…",
      "wc.connected": "钱包已连接",
      "wc.noInjected": "此环境没有检测到可用的浏览器钱包（TP / MetaMask / 币安钱包插件等）。请改用「Agentic Wallet 扫码」连接。",
      "wl.title": "你的身份。你的信号。",
      "wl.agentic": "Agentic Wallet 扫码",
      "wl.agenticSub": "连接币安 Agentic Wallet",
      "wl.browser": "浏览器钱包",
      "wl.browserSub": "连接可用的 EVM 钱包（TP / MetaMask 等）",
      "wl.note": "配对用于连接钱包；Mint 资格会另行验证 .ai 所有权。每次 Mint 均需确认。",
      "wc.needConnect": "请先在铸造区连接币安钱包",
      "wc.needInfo": "链上参数还没读到，请稍等再试",
      "tx.mint": "铸造交易",
      "tx.approve": "授权交易",
      "tx.gas": "gas",
      "cmd.body.legacy": `我有币安 Agentic Wallet，请在 BSC（binanceChainId {chain}）上帮我铸造 {name}。
我的钱包地址：{addr}{idLine}

规则：
- 先运行 \`baw wallet settings --json\`，确认 devMode.enabled 为 true。
- 每笔交易都按「preview → 把解析结果和风险给我看 → 等我确认 → \`baw contract-call execute --requestId <这次 preview 返回的 requestId> --json\`」执行。
- gas 预估加 20%。
- 上一笔在链上确认成功后，再开始下一笔。
- 任何一步 preview 报错或被拦截，就停下告诉我，不要改参数重试。

第 1 笔：给 {name} 合约授权 {amountText} USDT（授权额度已够可跳过；按 1.02 倍给）
  合约（USDT）: {uAddr}
  approve(spender = {cAddr}, amount = {amountText} USDT)
  调用数据: {approveData}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {uAddr} --inputData {approveData} --json

{tail}：调用 {name} 合约的 mint()，共 {count} 笔，每笔单独 preview + execute，每笔 {priceText} USDT 换 {perMint} {name}
  合约: {cAddr}
  调用数据: {mintData}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {cAddr} --inputData {mintData} --json

本次共 {count} 份 = {costText} USDT，预计得到 {totalText} {name}。
注意：绝不能直接把 USDT 转到 mint 合约，必须 approve 后调用 mint；只有 {cAddr} 收款。`,
      "hero.title": "持有币安 <em>Agent ID</em> 才能铸造",
      "hero.sub": "每次 <b>{price}</b> USDT 换 <b>{perMint}</b> 枚 {symbol}，单地址上限 <b>{limit}</b> 次。<br />下面填地址 → 自动检查资格 → 复制指令发给你的 AI 代理即可。",
      "hero.loading": "正在读取链上参数…",
      "prog.title": "Mint 进度",
      "prog.loading": "读取中…",
      "prog.of": "已 mint {a} / {b} 份",
      "prog.live": "进行中",
      "prog.launched": "已开盘",
      "prog.ended": "已结束",
      "prog.raised": "已募资",
      "prog.supply": "当前总供应",
      "prog.left": "剩余份数",
      "prog.deadline": "截止时间",
      "prog.done": "已停止 mint",
      "prog.cap": "{s} / 硬顶 {c}",
      "card.mint": "铸造区",
      "label.addr": "钱包地址 / .ai 名称",
      "ph.addr": "0x… 或 yourname.ai",
      "hint.addr": "填 .ai 名称（如 aveai）会自动解析成地址；也可直接填 0x 地址",
      "label.tokenId": "Agent ID 编号（选填）",
      "ph.tokenId": "例如 1234",
      "label.count": "铸造次数",
      "hint.count": "Up to 10 per transaction · 选择要铸造的份数（1–10），生成 AI 指令后由你的 AI 钱包一次性完成授权与铸造",
      "adv.summary": "高级：合约 / 代币参数",
      "label.contract": "合约地址", "label.usdt": "USDT 合约", "label.nft": "Agent ID NFT",
      "nav.wp": "白皮书",
      "btn.check": "检查资格", "btn.gen": "生成 AI 指令",
      "card.cmd": "AI 指令", "btn.copy": "复制",
      "ph.cmd": "选好份数后点「生成 AI 指令」，这里会出现可直接粘贴给 AI 代理的完整指令",
      "hint.cmd": "把这段指令粘到 Agentic Wallet 的 AI 对话里，它会逐步 preview 并等你确认。",
      "card.steps": "让 AI 代理帮你铸造",
      "s1.h": "开启开发者模式", "s1.p1": "在币安 App 中，为你的 Agentic Wallet 开启开发者模式。",
      "s1.p2": "Agentic Wallet → 设置 → 开发者模式",
      "s2.h": "检查资格", "s2.p1": "在上方铸造区输入你的 .ai 名称。这个地址需要有：",
      "s2.l1": "Agent ID", "s2.l2": "每次", "s2.l2b": "USDT", "s2.l3": "少量 BNB 付手续费",
      "s3.h": "发给你的 AI 代理", "s3.p1": "把指令粘贴到 Agentic Wallet 的 AI 对话里。每一步它都会先预览，等你确认后再执行。",
      "card.apply": "如何申请 Agent ID",
      "invite.label": "专属邀请链接", "invite.go": "去注册",
      "wp.addr": "已连接钱包", "wp.left": "剩余可 Mint", "wp.promoLabel": "我的推广链接",
      "wp.promoHint": "分享此链接，好友经它铸造，每成功推荐 1 位已铸造者，你的 Mint 额度 +1 份", "wp.copy": "复制",
      "wp.hint": "连接钱包后，这里会自动生成你的专属推广链接（?ref=你的地址），并显示剩余可 Mint 次数。",
      "hb1": "💎 100% 进 LP", "hb2": "🔒 LP 永久锁仓", "hb3": "🛡️ 合约无提取权限",
      "cta.mint": "立即铸造", "cta.scan": "BscScan 核验",
      "tok.title": "代币机制", "tok.sub": "每笔买入 / 卖出收取 3% 手续费，全部回馈社区：",
      "tok.burn": "1% 销毁 · 通缩减量", "tok.div": "1% 持币分红 · USDT 空投", "tok.lp": "1% 回流 LP · 底池加深",
      "faq.title": "常见问题",
      "faq.q1": "谁能铸造？", "faq.a1": "持有 .ai Agent ID 的币安 Agentic Wallet 地址即可铸造，每个 Agent ID 可铸 10 份。",
      "faq.q2": "铸造的代币能马上交易吗？", "faq.a2": "开盘前铸造的代币不可转账；开盘有两种触发：① owner 手动调用 launch()；② mint 打满时合约自动触发——两者都会将募集的 USDT 与等值的已铸代币注入 PancakeSwap 建立流动性（发射 LP 锁入黑洞），未售出的剩余代币留黑洞等效销毁。开盘后 owner 权限自动放弃，无法再改动或撤池。建议打满前由 owner 主动开盘以把控时机。",
      "faq.q3": "推广奖励怎么算？", "faq.a3": "分享你的专属推广链接（连接钱包后自动生成），每成功推荐 1 位已铸造者，你的额度 +1 份。",
      "faq.q4": "资金安全吗？", "faq.a4": "铸造资金 100% 注入 LP 底池，LP 发射后自动打入黑洞，合约无任何提取权限，全程链上可查。",
      "a1.h": "打开邀请链接", "a1.p": "用币安 App 扫码，或在币安 Web3 钱包内置浏览器打开，进入 Agent ID 页面。",
      "a2.h": "连接 / 创建 Agentic Wallet", "a2.p": "钱包里预留一点 BNB 付网络手续费。",
      "a3.h": "选 .ai 名称并提交", "a3.p": "按页面提示完成注册；是否仍需邀请名额，以官方页面显示为准。",
      "a4.h": "回来检查资格", "a4.p": "Agent ID 到账后，在上方铸造区填地址点「检查资格」，显示持有 ≥ 1 即可铸造。",
      "apply.note": "注册流程与名额以币安官方页面为准，可能随时调整。",
      "card.social": "社区与推广入口",
      "p1.b": "币安ai钱包申请链接", "p1.s": "去注册",
      "p3.b": "X / Twitter", "p3.s": "官方推特",

      "card.warn": "注意",
      "w1": "开盘前铸造到的 {sym} <b>不可转账</b>，需等开盘后才能交易。",
      "w2": "每笔交易 AI 都会先 preview，请逐笔看清解析结果与风险再确认。",
      "w3": "本页只做地址填写与指令生成，不托管私钥、不代发交易。",
      "footer": "{name} · {sym} — 本页不托管资产，请自行核对合约地址",

      "el.addr": "地址",
      "el.name": "Agent ID 名称 {n}", "el.resolved": "已解析为上方地址",
      "el.nft": "Agent ID 持有 {n} 个", "el.nftBad": "需要持有才能 mint",
      "el.usdt": "USDT 余额 {v}", "el.usdtNeed": "需 {v} USDT", "el.payBal": "{sym} 余额 {v}", "el.payNeed": "需 {v} {sym}",
      "el.bnb": "BNB {v}", "el.bnbNeed": "需少量付 gas",
      "el.launched": "已开盘，不能再 mint", "el.notLaunched": "未开盘，可 mint",
      "el.progress": "已 mint {a}/{b}",
      "el.quota": "本地址剩余额度 {n} 次", "el.quotaSub": "上限 {m} 次，已用 {u}",
      "el.deadlineOk": "mint 未截止", "el.deadlineBad": "mint 已截止",
      "el.allow": "已授权 {v} {sym}", "el.allowSkip": "第 1 笔可跳过", "el.allowNeed": "需要先授权",
      "el.loading": "正在读取链上数据…", "el.fail": "读取失败",

      "t.badAddr": "请填写 0x 地址或已注册的 .ai 名称",
      "t.needAddr": "请先填写 0x 地址或 .ai 名称",
      "t.noResolve": "解析失败：该 .ai 名称未注册，或格式不对",
      "t.resolving": "正在解析 .ai 名称…",
      "t.checkDone": "资格检查完成",
      "t.readFail": "链上读取失败：",
      "t.genOk": "指令已生成，点右上角复制",
      "t.copyOk": "已复制到剪贴板",
      "t.copyFail": "请按 Ctrl+C 复制",
      "t.copyLink": "链接已复制",
      "t.copyLinkFail": "复制失败，请手动复制",
      "t.walletOk": "钱包已连接",
      "t.noWallet": "未检测到钱包，正在跳转币安登录",
      "t.connectFail": "连接失败",
      "t.redirecting": "正在跳转币安登录…",
      "t.wrongChain": "请切换到 BSC 主网（Chain ID 56）",
      "t.approving": "正在授权 USDT…",
      "t.approveOk": "授权成功",
      "t.minting": "铸造交易已提交，等待确认…",
      "t.mintOk": "铸造成功",
      "t.mintFail": "铸造失败",
      "t.genFirst": "请先生成指令",
      "t.genCopied": "指令已复制，发给你的 AI 代理即可",
      "ai.title": "用币安 AI 钱包（Agentic Wallet）铸造",
      "ai.s1": "选好份数 → 点「生成 AI 指令」，指令会<b>自动复制</b>到剪贴板，直接粘贴给 AI 即可。",
      "ai.s2": "把指令发给你自己的 AI 代理（需已安装币安 Agentic Wallet 的 <code>baw</code> CLI 并开启 devMode）。",
      "ai.s3": "代理会用你的 AI 钱包完成 approve + mint，每笔都会先 preview 并等你确认。",
      "ai.note": "本页支持两种铸造方式：① 在上方铸造区点「连接币安钱包」直接铸造（扫码 → 在币安 App 内确认）；② 或点「生成 AI 指令」交给 AI 代理执行。Agentic Wallet 是给 AI 代理用的钱包，没有网页直连接口，因此方式②由网页生成指令、AI 代理执行，与 jager.live 做法一致。",
      "sec.title": "合约安全检测",
      "sec.verify": "BscScan 核验",
      "sec.scoreLabel": "风险评分",
      "sec.badges": "高危 0 · 中危 0 · 提示 2",
      "sec.contract": "合约",
      "sec.creator": "创建者 / 拥有者",
      "sec.liquidity": "开盘动作",
      "sec.liquidityV": "等值代币 + 募集 USDT 注入 PancakeSwap V2 交易对",
      "sec.summaryTitle": "AI 概括",
      "sec.summary": "{sym} 是固定配置的 ERC20，铸造阶段受指定 Agent ID NFT 持有门槛限制且有硬顶（{cap} 份）。每份支付 {price} USDT 获得 {perMint} 枚代币；开盘时，合约将等值代币及募集到的 USDT 注入 PancakeSwap V2 交易对。开盘后，涉及交易对的转账收取 3% 手续费（1% 销毁进黑洞 + 1% 持币分红以 USDT 发放 + 1% 回流自动加 LP）。",
      "sec.taxTitle": "AI 税收检测",
      "sec.t1": "买入税：3%（1% 销毁 + 1% 分红 + 1% LP）",
      "sec.t2": "卖出税：3%（1% 销毁 + 1% 分红 + 1% LP）",
      "sec.t3": "转账税：0%",
      "sec.t4": "单钱包最大量：每地址基础 10 份 mint shares，每成功推荐 1 位已铸造者 +1 份；开盘后无持币上限",
      "sec.note": "以上为合约机制说明；铸造前请在 BscScan 自行核验合约源码。",

      "cmd.body": `我有币安 Agentic Wallet，请在 BSC（binanceChainId {chain}）上帮我铸造 {name}。{idLine}

规则：
- 使用你当前默认连接的 Agentic Wallet（\`baw wallet settings\` 显示的那个）发起所有交易，无需我提供地址，也不要改成别的地址。
- 先运行 \`baw wallet settings --json\`，确认 devMode.enabled 为 true、且当前钱包就是你的 Agentic Wallet。
- 每笔交易都按「preview → 把解析结果和风险给我看 → 等我确认 → \`baw contract-call execute --requestId <这次 preview 返回的 requestId> --json\`」执行。
- gas 预估加 20%。
- 上一笔在链上确认成功后，再开始下一笔。

【执行前必做 · 每次都重新读取链上状态，严禁直接复用上次生成的参数】
1) 读取合约当前状态（用 ethers 读合约，或让 baw 读）：
   - launched() 必须为 false（mint 阶段 / 未开盘），否则 mint 会 revert；开盘后不能再 mint，请停下来告诉我「mint 已结束」。
   - PRICE() 当前单价、MAX_PER_WALLET() 与 mintedBy(<你的钱包地址>) 看剩余可铸额度。
   - 用 AGENT_ID() 指向的注册表（或 SPACE ID 注册表 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F 的 ownerOf(namehash("你的.agent.id"))）确认【当前这个 Agentic Wallet 地址】确实持有 .ai Agent ID。若持有者不是当前钱包，mint 必然 revert —— 请改用持有 Agent ID 的那个钱包，并告诉我。
2) 用【刚刚读到的 PRICE()】重算：cost = PRICE × {count}；maxCost = cost × 1.1（留 10% 余量，防价格随铸造推进上涨）。若与下面写死的 maxCost 不一致，用新值重新生成下面两笔的调用数据后再 preview，不要沿用旧参数。

{approveBlock}{mintStepLabel}：调用 mint 合约的 mint(uint256 shares, address referrer, uint256 maxCost)，一次性买 {count} 份（全部份数一笔完成，不要拆成多次）
  shares   = {count}
  referrer = {ref}（来自 ?ref= 推广链接；推荐人须已 mint 过才生效，否则该笔不额外计奖）
  maxCost  = 见上方重算值（实际花费约 {costText} {paySymbol}）
  合约: {cAddr}
  调用数据: {mintData}
  baw contract-call preview --binanceChainId {chain} --to {cAddr} --inputData {mintData}{mintValueArg} --json

若 preview 报 execution reverted：
- 先读 revert 原因（如 maxCost too low / not launched / not eligible / cap reached）。
- 若是 maxCost 不够，用最新 PRICE 提高 maxCost 后重新生成调用数据再 preview（这属于按链上状态重算，不是盲目重试）。
- 若是 not eligible，说明当前钱包不持有 Agent ID，停下来告诉我。
- {payNote}`,
    },

    en: {
      "brand.sub": "Agent ID exclusive mint · BSC",
      "ticker.text": "{price} USDT per share for {perMint} {sym} · mint requires a Binance Agent ID · {cap}-share hard cap · 3% buy/sell tax (1% burn + 1% USDT holder dividend + 1% LP) · refer a friend for +1 share",
      "btn.connect": "Connect to verify ↗",
      "btn.walletMint": "Mint now",
      "wc.hint": "Connect the Binance wallet that holds your .ai Agent ID to mint directly on this page (approve + mint)",
      "wc.title": "Agent Wallet",
      "wc.tip": "Connect Binance Agent Wallet to read the .ai Agent ID on this wallet.",
      "wc.badgeConnecting": "Connecting",
      "wc.badgeOk": "Connected",
      "wc.pairLabel": "Pairing code",
      "wc.pairTip": "Scan with the Binance App, then check that the pairing code matches before confirming.",
      "wc.afterConfirm": "After you confirm, this page switches to your wallet.",
      "wc.waiting": "Waiting for the Binance App",
      "wc.regular": "Use a regular wallet",
      "wc.noInjected": "No browser wallet detected",
      "wc.openApp": "Open Binance sign-in",
      "wc.openSite": "Open this site in the Binance App",
      "wc.qrModeWc": "Scan with the Binance App, then check that the pairing code matches before confirming.",
      "wc.badUri": "Invalid URI (not a valid wc: pairing string) — send the text below to the developer",
      "wc.qrModeUrl": "Scan with the Binance App → this site opens inside the App → press \"Mint\" there (the App has the Binance wallet built in, no pairing needed).",
      "wc.urlQrHint": "WalletConnect is not responding — switched to a URL QR code: scan it with the Binance App to open this site and mint inside the App.",
      "wc.cancel": "Cancel connection",
      "wc.notBinance": "A non-Binance wallet (e.g. MetaMask) was detected. This page only connects to Binance Wallet: open this site inside the Binance App, install the Binance Wallet extension, or use the QR option.",
      "wc.scanMode": "No Binance Wallet detected: pressing \"Mint now\" shows a QR code — scan it with the Binance App and the mint completes automatically.",
      "wc.copyLink": "Copy page URL",
      "wc.copyLinkOk": "URL copied — open it inside the Binance App to connect your wallet and mint",
      "wc.qrReady": "QR code ready — scan it with the Binance App to approve",
      "wc.slowHint": "The connection service is not responding: most likely this domain is not in Allowed origins in the Reown dashboard, or the network is blocked. You can also copy the page URL and open it inside the Binance App.",
      "wc.noWay": "No Binance Wallet found and QR connection unavailable. Open this site inside the Binance App (Web3 Wallet → Discover → paste URL), or use \"Generate AI command\" and let your AI agent mint for you.",
      "wc.diagTitle": "Diagnostics (open this if the wallet won't connect)",
      "wc.diagCopy": "Copy diagnostics",
      "wc.diagReload": "Re-check",
      "wc.diagCopied": "Diagnostics copied — paste them to the developer",
      "wc.relayBlockedShort": "Cannot reach the WalletConnect relay from this network — QR connect unavailable",
      "wc.relayBlocked": "Cannot reach the WalletConnect relay from this network (connection reset), so QR connect is unavailable. Pick one: ① install the <a href='https://chromewebstore.google.com/detail/binance-wallet/cadiboklkpojfamcoggejbbdjcoiljjk' target='_blank' rel='noopener'>Binance Wallet Chrome extension</a>, then press \"Connect Binance Wallet\" to connect directly (no relay needed); ② open this site inside the Binance App Web3 browser. You can also use \"Generate AI command\" and let your AI agent mint.",
      "wc.netTest": "Test connection service",
      "wc.netTesting": "Running a real WalletConnect handshake… (up to 20s)",
      "wc.netRelayOk": "✓ Relay connected (network is fine). Requesting pairing to verify the projectId…",
      "wc.netDone": "Connectivity test done — see the result below",
      "wc.connectingFirst": "Connecting Binance Wallet…",
      "wc.needId": "WalletConnect projectId not configured — QR connect unavailable",
      "wc.pidSaved": "projectId saved",
      "wc.connecting": "Connecting…",
      "wc.connected": "Wallet connected",
      "wc.noInjected": "No browser wallet (TP / MetaMask / Binance Wallet extension, etc.) detected here. Use \"Agentic Wallet QR\" instead.",
      "wl.title": "Your identity. Your signal.",
      "wl.agentic": "Agentic Wallet QR",
      "wl.agenticSub": "Connect Binance Agentic Wallet",
      "wl.browser": "Browser wallet",
      "wl.browserSub": "Connect an available EVM wallet (TP / MetaMask, etc.)",
      "wl.note": "Pairing is for connecting the wallet; mint eligibility verifies .ai ownership separately. Every mint requires confirmation.",
      "wc.needConnect": "Connect your Binance wallet first (in the mint box)",
      "wc.needInfo": "On-chain params not loaded yet, please retry",
      "tx.mint": "Mint tx",
      "tx.approve": "Approve tx",
      "tx.gas": "gas",
      "cmd.body.legacy": `I have a Binance Agentic Wallet. Please mint {name} for me on BSC (binanceChainId {chain}).
My wallet address: {addr}{idLine}

Rules:
- First run \`baw wallet settings --json\` and confirm devMode.enabled is true.
- For every transaction: preview → show me the parsed result and risks → wait for my confirmation → \`baw contract-call execute --requestId <requestId from that preview> --json\`.
- Add 20% to the gas estimate.
- Only start the next transaction after the previous one is confirmed on chain.
- If any preview errors out or gets blocked, stop and tell me. Do not retry with changed parameters.

Tx 1: approve {amountText} USDT to the {name} contract (skip if allowance is already enough; 1.02x buffer)
  USDT contract: {uAddr}
  approve(spender = {cAddr}, amount = {amountText} USDT)
  Input data: {approveData}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {uAddr} --inputData {approveData} --json

{tail}: call mint() on the {name} contract, {count} tx total, each with its own preview + execute, {priceText} USDT for {perMint} {name} per mint
  Contract: {cAddr}
  Input data: {mintData}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {cAddr} --inputData {mintData} --json

Total: {count} shares = {costText} USDT, expected {totalText} {name}.
Important: never transfer USDT directly to the mint contract. Always approve then call mint. {cAddr} is the only address that accepts payment.`,
      "hero.title": "Only Binance <em>Agent ID</em> holders can mint",
      "hero.sub": "Each mint costs <b>{price}</b> USDT for <b>{perMint}</b> {symbol}, max <b>{limit}</b> per wallet.<br />Enter your address → auto-check eligibility → copy the command to your AI agent.",
      "hero.loading": "Loading on-chain parameters…",
      "prog.title": "Mint progress",
      "prog.loading": "Loading…",
      "prog.of": "{a} / {b} mints",
      "prog.live": "Live",
      "prog.launched": "Launched",
      "prog.ended": "Ended",
      "prog.raised": "Raised",
      "prog.supply": "Current supply",
      "prog.left": "Remaining",
      "prog.deadline": "Deadline",
      "prog.done": "Mint closed",
      "prog.cap": "{s} / cap {c}",
      "card.mint": "Mint",
      "label.addr": "Wallet address / .ai name",
      "ph.addr": "0x… or yourname.ai",
      "hint.addr": "A .ai name (e.g. aveai) is resolved to an address automatically; a 0x address also works",
      "label.tokenId": "Agent ID number (optional)",
      "ph.tokenId": "e.g. 1234",
      "label.count": "Mint count",
      "hint.count": "Up to 10 per transaction · Pick how many shares (1–10). The AI command mints them all in one transaction after approval",
      "adv.summary": "Advanced: contract / token params",
      "label.contract": "Contract", "label.usdt": "USDT contract", "label.nft": "Agent ID NFT",
      "btn.check": "Check eligibility", "btn.gen": "Generate command",
      "card.cmd": "AI command", "btn.copy": "Copy",
      "ph.cmd": "Pick the share count and click Generate — the full command for your AI agent appears here",
      "hint.cmd": "Paste it into your Agentic Wallet AI chat. It previews every step and waits for your confirmation.",
      "card.steps": "Let Your AI Agent Mint For You",
      "s1.h": "Enable Developer Mode", "s1.p1": "In the Binance App, enable Developer Mode for your Agentic Wallet.",
      "s1.p2": "Agentic Wallet → Settings → Developer Mode",
      "s2.h": "Check eligibility", "s2.p1": "Enter your .ai name in the mint box above. This address needs:",
      "s2.l1": "Agent ID", "s2.l2": "per mint", "s2.l2b": "USDT", "s2.l3": "A little BNB for gas",
      "s3.h": "Send it to your AI agent", "s3.p1": "Paste the command into your Agentic Wallet AI chat. It previews each step and waits for your confirmation.",
      "card.apply": "How to Apply for Agent ID",
      "invite.label": "Exclusive invite link", "invite.go": "Register",
      "wp.addr": "Connected wallet", "wp.left": "Mint quota left", "wp.promoLabel": "My referral link",
      "wp.promoHint": "Share this link — friends who mint via it add +1 to your mint quota per referred minter", "wp.copy": "Copy",
      "wp.hint": "After connecting your wallet, your exclusive referral link (?ref=your address) is generated here, and your remaining mint quota is shown.",
      "hb1": "💎 100% to LP", "hb2": "🔒 LP locked forever", "hb3": "🛡️ No withdrawal rights",
      "cta.mint": "Mint Now", "cta.scan": "Verify on BscScan",
      "tok.title": "Tokenomics", "tok.sub": "3% fee on every buy / sell, all goes back to the community:",
      "tok.burn": "1% burn · deflationary", "tok.div": "1% holder dividend in USDT", "tok.lp": "1% auto LP · deeper pool",
      "faq.title": "FAQ",
      "faq.q1": "Who can mint?", "faq.a1": "Any Binance Agentic Wallet holding a .ai Agent ID can mint; each Agent ID gets 10 shares.",
      "faq.q2": "Can I trade right after minting?", "faq.a2": "Tokens minted before launch cannot be transferred; once the mint target is reached the pool opens on PancakeSwap automatically.",
      "faq.q3": "How does the referral reward work?", "faq.a3": "Share your exclusive referral link (auto-generated after connecting your wallet); each referred minter adds +1 share to your quota.",
      "faq.q4": "Is it safe?", "faq.a4": "100% of raised funds go into the LP, LP is locked to the contract, and the contract has no withdrawal rights — all verifiable on-chain.",
      "a1.h": "Open the invite link", "a1.p": "Scan with the Binance App or open it in the Binance Web3 wallet browser to reach the Agent ID page.",
      "a2.h": "Connect / create Agentic Wallet", "a2.p": "Keep a little BNB in the wallet for gas.",
      "a3.h": "Pick your .ai name and submit", "a3.p": "Follow the page instructions; whether an invite slot is still required follows the official page.",
      "a4.h": "Come back and check", "a4.p": "Once your Agent ID arrives, enter the address above and click Check — holding ≥ 1 means you can mint.",
      "apply.note": "The registration flow and availability follow Binance's official page and may change at any time.",
      "card.social": "Community & Links",
      "p1.b": "Exclusive invite link", "p1.s": "Register",
      "p3.b": "X / Twitter", "p3.s": "Official X account",

      "card.warn": "Notes",
      "w1": "{sym} minted before launch <b>cannot be transferred</b> until trading opens.",
      "w2": "Your AI previews every transaction — read each parsed result and risk note before confirming.",
      "w3": "This page only builds the command. It never holds your keys or sends transactions for you.",
      "footer": "{name} · {sym} — this page does not custody assets; always verify the contract address",
      "nav.wp": "Whitepaper",

      "el.addr": "Address",
      "el.name": "Agent ID name {n}", "el.resolved": "resolved to the address above",
      "el.nft": "Agent ID held: {n}", "el.nftBad": "You must hold one to mint",
      "el.usdt": "USDT balance {v}", "el.usdtNeed": "need {v} USDT", "el.payBal": "{sym} balance {v}", "el.payNeed": "need {v} {sym}",
      "el.bnb": "BNB {v}", "el.bnbNeed": "keep some for gas",
      "el.launched": "Already launched — mint closed", "el.notLaunched": "Not launched — mint open",
      "el.progress": "minted {a}/{b}",
      "el.quota": "Remaining quota: {n}", "el.quotaSub": "limit {m}, used {u}",
      "el.deadlineOk": "Mint window open", "el.deadlineBad": "Mint window closed",
      "el.allow": "Allowance {v} {sym}", "el.allowSkip": "step 1 can be skipped", "el.allowNeed": "approve first",
      "el.loading": "Reading on-chain data…", "el.fail": "Read failed",

      "t.badAddr": "Enter a 0x address or a registered .ai name",
      "t.needAddr": "Enter a 0x address or .ai name first",
      "t.noResolve": "Resolve failed: this .ai name is not registered or is malformed",
      "t.resolving": "Resolving .ai name…",
      "t.checkDone": "Eligibility check done",
      "t.readFail": "On-chain read failed: ",
      "t.genOk": "Command generated — click Copy",
      "t.copyOk": "Copied to clipboard",
      "t.copyFail": "Press Ctrl+C to copy",
      "t.copyLink": "Link copied",
      "t.copyLinkFail": "Copy failed, please copy manually",
      "t.walletOk": "Wallet connected",
      "t.noWallet": "No wallet detected, redirecting to Binance login",
      "t.connectFail": "Connection failed",
      "t.redirecting": "Redirecting to Binance login…",
      "t.wrongChain": "Please switch to BSC mainnet (Chain ID 56)",
      "t.approving": "Approving USDT…",
      "t.approveOk": "Approval confirmed",
      "t.minting": "Mint transaction submitted, waiting…",
      "t.mintOk": "Mint succeeded",
      "t.mintFail": "Mint failed",
      "t.genFirst": "Generate the command first",
      "t.genCopied": "Command copied — paste it to your AI agent",
      "ai.title": "Mint with Binance Agentic Wallet (AI wallet)",
      "ai.s1": "Pick the share count → press \"Generate AI command\" — the full command is <b>copied automatically</b> to your clipboard, just paste it to your AI.",
      "ai.s2": "Send the command to your own AI agent (Binance Agentic Wallet <code>baw</code> CLI installed, devMode enabled).",
      "ai.s3": "The agent approves and mints with your AI wallet, previewing every transaction and waiting for your confirmation.",
      "ai.note": "Two mint ways: ① click \"Connect Binance Wallet\" in the mint box above to mint directly (scan QR → confirm in the Binance App); ② or \"Generate AI command\" to let your AI agent mint. Agentic Wallet has no web-connect interface, so way ② works as: page generates the command, AI agent executes — same as jager.live.",
      "sec.title": "Contract Security Check",
      "sec.verify": "Verify on BscScan",
      "sec.scoreLabel": "Risk score",
      "sec.badges": "High 0 · Medium 0 · Info 2",
      "sec.contract": "Contract",
      "sec.creator": "Creator / Owner",
      "sec.liquidity": "At launch",
      "sec.liquidityV": "equal minted tokens + raised USDT injected into the PancakeSwap V2 pair",
      "sec.summaryTitle": "AI Summary",
      "sec.summary": "{sym} is a fixed-config ERC20; the mint phase is gated by holding a specified Agent ID NFT and has a hard cap ({cap} shares). Each share pays {price} USDT for {perMint} tokens; at launch the contract injects an equal amount of minted tokens and the raised USDT into the PancakeSwap V2 pair. After launch, transfers involving the pair incur a 3% fee (1% burn to the dead address + 1% USDT holder dividend + 1% auto-LP).",
      "sec.taxTitle": "AI Tax Check",
      "sec.t1": "Buy tax: 3% (1% burn + 1% dividend + 1% LP)",
      "sec.t2": "Sell tax: 3% (1% burn + 1% dividend + 1% LP)",
      "sec.t3": "Transfer tax: 0%",
      "sec.t4": "Per-wallet cap: 10 mint shares base per address, +1 per successfully referred minter; no post-launch token balance limit",
      "sec.note": "Mechanism description above — verify the contract source on BscScan before minting.",

      "cmd.body": `I have a Binance Agentic Wallet. Please mint {name} for me on BSC (binanceChainId {chain}).{idLine}

Rules:
- Use your currently connected Agentic Wallet (the one shown by \`baw wallet settings\`) for all transactions. Do not ask me for an address and do not change it.
- First run \`baw wallet settings --json\` and confirm devMode.enabled is true and the current wallet is your Agentic Wallet.
- For every transaction: preview → show me the parsed result and risks → wait for my confirmation → \`baw contract-call execute --requestId <requestId from that preview> --json\`.
- Add 20% to the gas estimate.
- Only start the next transaction after the previous one is confirmed on chain.

[Before any transaction — re-read on-chain state every time; never reuse previously generated parameters]
1) Read the contract's current state (via ethers, or let baw read it):
   - launched() must be false (mint phase / not launched), otherwise mint reverts; once launched, mint is closed. Stop and tell me "mint ended".
   - PRICE() (current unit price), MAX_PER_WALLET() and mintedBy(<your wallet address>) to see remaining quota.
   - Using AGENT_ID()'s registry (or the SPACE ID registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F, ownerOf(namehash("your.agent.id"))), confirm that THIS Agentic Wallet address actually holds the .ai Agent ID. If the holder is a different wallet, mint will revert — switch to the wallet that holds the Agent ID and tell me.
2) Recompute with the PRICE() you just read: cost = PRICE × {count}; maxCost = cost × 1.1 (10% headroom against price steps). If it differs from the maxCost written below, regenerate the calldata for both transactions with the new value before previewing. Do not use stale parameters.

{approveBlock}{mintStepLabel}: call mint(uint256 shares, address referrer, uint256 maxCost) on the mint contract — {count} shares in a SINGLE transaction (all shares at once, do NOT split into multiple mints)
  shares   = {count}
  referrer = {ref} (from the ?ref= invite link; only counts if that referrer has minted before, otherwise no bonus)
  maxCost  = see recompute above (actual cost ~ {costText} {paySymbol})
  Contract: {cAddr}
  Input data: {mintData}
  baw contract-call preview --binanceChainId {chain} --to {cAddr} --inputData {mintData}{mintValueArg} --json

If preview reports "execution reverted":
- Read the revert reason (e.g. maxCost too low / not launched / not eligible / cap reached).
- If maxCost is too low, raise it using the latest PRICE and regenerate the calldata, then preview again (this is recomputing from chain state, not a blind retry).
- If not eligible, the current wallet does not hold the Agent ID — stop and tell me.
- {payNote}`,
    },
  };

  // 链上身份（name/symbol），默认回退值；loadInfo 读到链上后自动更新并重渲染
  let CHAIN_NAME = "火星币";
  let CHAIN_SYMBOL = "火星币";

  // 换了 key：以前存过的语言偏好不再生效，一律从英文开始
  const LANG_KEY = "agt_lang_v2";

  let LANG = localStorage.getItem(LANG_KEY);
  if (LANG !== "zh" && LANG !== "en") LANG = "en"; // 默认英文

  function t(key, vars) {
    let s = (I18N[LANG] && I18N[LANG][key]) || (I18N.zh[key] && I18N.zh[key]) || key;
    const all = Object.assign(
      { sym: CHAIN_SYMBOL, name: CHAIN_NAME, price: heroVals.price, perMint: heroVals.perMint, limit: heroVals.limit, cap: heroVals.cap || "10,000" },
      vars || {}
    );
    for (const k in all) s = s.split("{" + k + "}").join(all[k]);
    return s;
  }

  let heroVals = { price: "1", perMint: "50,000,000", symbol: "火星币", limit: "10", cap: "10,000" };
  let heroReady = false; // 是否已拿到真实参数（链上读到的或本地缓存的）

  // 上次读到的参数缓存，按合约地址存，刷新时先渲染它，避免先显示默认值再跳变
  const HERO_CACHE_KEY = "agt_hero_cache";

  function loadHeroCache(addr) {
    try {
      const m = JSON.parse(localStorage.getItem(HERO_CACHE_KEY)) || {};
      return m[String(addr).toLowerCase()] || null;
    } catch {
      return null;
    }
  }

  function saveHeroCache(addr, vals) {
    try {
      const m = JSON.parse(localStorage.getItem(HERO_CACHE_KEY)) || {};
      m[String(addr).toLowerCase()] = vals;
      localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(m));
    } catch {}
  }

  // 铸造次数 1~10（步进器 − 01 +，对应目标站 How many shares?）
  function buildCountOptions() {
    const box = $("count");
    if (!box) return;
    box.innerHTML = "";
    const minus = document.createElement("button");
    minus.type = "button"; minus.className = "step-btn"; minus.textContent = "−"; minus.setAttribute("aria-label", "减少");
    const val = document.createElement("span");
    val.className = "step-val"; val.id = "countVal";
    const plus = document.createElement("button");
    plus.type = "button"; plus.className = "step-btn"; plus.textContent = "+"; plus.setAttribute("aria-label", "增加");
    const render = () => {
      val.textContent = String(selectedCount).padStart(2, "0");
      minus.disabled = selectedCount <= 1;
      plus.disabled = selectedCount >= 10;
    };
    minus.addEventListener("click", () => { selectedCount = Math.max(1, selectedCount - 1); render(); updatePayTotal(); });
    plus.addEventListener("click", () => { selectedCount = Math.min(10, selectedCount + 1); render(); updatePayTotal(); });
    box.append(minus, val, plus);
    render();
  }

  function paintHero() {
    const sub = heroReady ? t("hero.sub", heroVals) : t("hero.loading");
    document.querySelectorAll("[data-i18n-html='hero.sub']").forEach((el) => (el.innerHTML = sub));
    document.querySelectorAll(".step .price").forEach((el) => (el.textContent = heroReady ? heroVals.price : "…"));
    if ($("heroName")) $("heroName").textContent = CHAIN_NAME;
    if ($("heroSymbol")) $("heroSymbol").textContent = CHAIN_SYMBOL;
    if ($("logoMark")) { const m = $("logoMark"); if (!m.querySelector("img")) { m.textContent = CHAIN_SYMBOL; m.classList.toggle("logo-sm", CHAIN_SYMBOL.length > 4); } }
    if ($("heroBadgeText")) { const b = $("heroBadgeText"); b.textContent = CHAIN_SYMBOL; b.classList.toggle("logo-sm", CHAIN_SYMBOL.length > 4); }
    if ($("acName")) $("acName").textContent = CHAIN_NAME;
  }

  // 用链上身份刷新 <title> / hero / 安全检测卡，并重渲染带占位符的文案
  function paintIdentity() {
    document.title = CHAIN_NAME + " · Agent ID 专属铸造";
    const addr = (info && info.contract) || CONFIG.CONTRACT;
    const short = addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
    if ($("secName")) $("secName").textContent = CHAIN_SYMBOL;
    if ($("secAddrLink")) {
      $("secAddrLink").href = "https://bscscan.com/address/" + addr;
      $("secAddrLink").textContent = short;
    }
    applyLang(LANG);
    // PAY WITH 标识按探测到的付款代币显示
    const pw = document.querySelector(".pw-opt");
    if (pw) pw.innerHTML = info && info.nativePay ? 'B BNB <i class="pw-check">✓</i>' : '₮ USDT <i class="pw-check">✓</i>';
    if ($("payCost") && info && info.price != null) {
      $("payCost").textContent = fmtPay(info.price) + " " + ((info && info.paySymbol) || "USDT");
    }
    updatePayTotal();
  }

  // 付款金额格式化（wei BigInt → 可读数字，按付款代币精度）
  function fmtPay(v) {
    return Number(ethers.formatUnits(v, Number(info && info.usdtDec) || 18)).toLocaleString("en-US", { maximumFractionDigits: 6 });
  }

  // Total cost = 份数 × 单价，随步进器联动
  function updatePayTotal() {
    const el = $("payTotal");
    if (!el) return;
    const sym = (info && info.paySymbol) || "USDT";
    el.textContent = (info && info.price != null ? fmtPay(BigInt(info.price) * BigInt(selectedCount)) : "—") + " " + sym;
  }

  // 滚动条：克隆文案直到填满两屏宽，避免滚动时右侧出现空白
  function fillTicker() {
    const track = $("tickerTrack");
    const box = track && track.parentElement;
    if (!track || !box) return;
    const base = track.querySelector("span");
    if (!base) return;
    track.innerHTML = "";
    track.appendChild(base);
    const target = box.clientWidth * 2 + base.offsetWidth;
    while (track.scrollWidth < target) track.appendChild(base.cloneNode(true));
    if (track.children.length % 2 === 1) track.appendChild(base.cloneNode(true));
  }

  function applyLang(lang) {
    LANG = lang;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    $("langBtn").textContent = lang === "zh" ? "EN" : "中";
    buildCountOptions();
    paintHero();
    updateProgress();
    renderRows();
    fillTicker();
    if ($("cmd").value && resolved) $("cmd").value = buildCommand() || $("cmd").value;
  }

  let provider = null;
  let info = null;
  let account = null;
  let walletProvider = null; // 连上的钱包（注入的或 WalletConnect）
  let wcProvider = null;
  let selectedCount = 10; // 点选的铸造份数（1–10），默认 10 份
  let lastCheck = null;
  let resolved = null; // { addr, name }

  function shortAddr(a) {
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function toast(msg, type) {
    const el = $("toast");
    el.textContent = msg;
    el.className = "show " + (type || "");
    clearTimeout(el._t);
    el._t = setTimeout(() => ((el.className = type || ""), 3600));
  }

  async function getProvider() {
    if (provider) return provider;
    for (const url of RPCS) {
      try {
        const p = new ethers.JsonRpcProvider(url);
        await p.getBlockNumber();
        provider = p;
        return p;
      } catch {}
    }
    throw new Error("all public RPCs unavailable");
  }

  /* ---------- 地址 / .ai 名称解析 ----------
     Agent ID 基于 SPACE ID：tokenId = uint256(keccak256(标签))，ownerOf(tokenId) 即持有地址。
     标签不含 ".ai"，且区分大小写（链上按原始字节哈希）。 */

  function labelOf(v) {
    let s = v.trim();
    s = s.replace(/^@/, "").replace(/\.ai$/i, "");
    return /^[a-z0-9][a-z0-9-]{0,62}$/i.test(s) ? s : null;
  }

  async function ensureResolved() {
    const el = $("addr");
    const v = (el ? el.value : "").trim();
    if (!v) {
      toast(t("t.needAddr"), "err");
      return null;
    }
    if (ethers.isAddress(v)) {
      resolved = { addr: ethers.getAddress(v), name: null };
      return resolved;
    }
    const label = labelOf(v);
    if (!label) {
      toast(t("t.noResolve"), "err");
      return null;
    }
    toast(t("t.resolving"));
    try {
      const p = await getProvider();
      const nft = new ethers.Contract($("nft").value.trim(), ["function ownerOf(uint256) view returns (address)"], p);
      const id = BigInt(ethers.keccak256(ethers.toUtf8Bytes(label)));
      const owner = await nft.ownerOf(id);
      if (!owner || owner === ethers.ZeroAddress) throw new Error("not registered");
      resolved = { addr: ethers.getAddress(owner), name: label + ".ai" };
      return resolved;
    } catch {
      toast(t("t.noResolve"), "err");
      return null;
    }
  }

  /* ---------- 载入合约参数（无需地址） ---------- */

  async function loadInfo() {
    const p = await getProvider();
    const c = new ethers.Contract(
      $("contract").value.trim(),
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function PRICE() view returns (uint256)",
        "function PER_MINT() view returns (uint256)",
        "function maxSharesPerId() view returns (uint256)",
        "function totalSharesCap() view returns (uint256)",
        "function totalSharesMinted() view returns (uint256)",
        "function mintedShares(address) view returns (uint256)",
        "function referralBonus(address) view returns (uint256)",
        "function raisedUSDT() view returns (uint256)",
        "function launched() view returns (bool)",
        "function USDT() view returns (address)",
        "function AGENT_ID() view returns (address)",
        "function totalSupply() view returns (uint256)",
        "event Mint(address indexed user, uint256 shares, address referrer)",
      ],
      p
    );
    // 探测付款代币：优先用合约 USDT()（ERC20）；若合约无此函数或返回 0，则视为原生 BNB 付款
    let u = null, nativePay = false, paySymbol = "USDT", payToken = null, usdtDec = 18;
    try {
      const tk = await c.USDT();
      if (tk && tk !== ethers.ZeroAddress) {
        payToken = tk;
        u = new ethers.Contract(tk, [
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address,address) view returns (uint256)",
        ], p);
        usdtDec = Number(await u.decimals());
      } else {
        nativePay = true; paySymbol = "BNB";
      }
    } catch {
      nativePay = true; paySymbol = "BNB";
    }

    const [name, symbol, price, perMint, maxSharesPerId, totalSharesCap, totalSharesMinted, launched, nft] =
      await Promise.all([
        c.name(), c.symbol(), c.PRICE(), c.PER_MINT(), c.maxSharesPerId(), c.totalSharesCap(),
        c.totalSharesMinted(), c.launched(), c.AGENT_ID(),
      ]);

    // 兼容旧字段名（info / heroVals / updateProgress 仍引用这些名）
    const maxPerWallet = maxSharesPerId;   // 基础上限（不含推广）
    const maxMints = totalSharesCap;       // 总硬顶
    const mintCount = totalSharesMinted;   // 已 mint 份数
    const deadline = 0n;                   // 合约无 mint 截止时间
    const maxSupply = 0n;

    // 旧版合约可能没有 raisedUSDT，容错处理
    const [usdtRaised, totalSupply] = await Promise.all([
      c.raisedUSDT().catch(() => price * totalSharesMinted),
      c.totalSupply().catch(() => totalSharesMinted * perMint),
    ]);

    // 探测合约版本：含新选择器 0x836a1040 说明是 shares 版，否则是旧的无参 mint()
    const code = await provider.getCode(await c.getAddress()).catch(() => "0x");
    const mintVer = code && code.includes("836a1040") ? "shares" : "single";

    info = { c, u, contract: await c.getAddress(), name: name || "火星币", symbol: symbol || "火星币", price, perMint, maxPerWallet, maxMints, mintCount, deadline, launched, usdtDec, nft, usdtRaised, totalSupply, maxSupply, mintVer, nativePay, paySymbol, payToken };

    CHAIN_NAME = name || "火星币";
    CHAIN_SYMBOL = symbol || "火星币";
    heroVals = {
      price: ethers.formatUnits(price, usdtDec),
      perMint: Number(ethers.formatUnits(perMint, 18)).toLocaleString("en-US"),
      symbol: symbol || "火星币",
      limit: String(maxPerWallet),
      cap: Number(maxMints).toLocaleString("en-US"),
    };
    heroReady = true;
    saveHeroCache(info.contract, heroVals);
    paintHero();
    paintIdentity();
    if (info.u) $("usdt").value = await info.u.getAddress();
    $("nft").value = nft;
    updateProgress();
    loadMintRanking().catch(() => {});
    return info;
  }

  /* ---------- 铸造排行榜 ---------- */
  const MINT_TOPIC = ethers.id("Mint(address,uint256,address)");

  async function loadMintRanking() {
    const tb = $("rankBody");
    if (!tb) return; // 排行榜已移除，跳过查询
    tb.innerHTML = '<tr><td colspan="4" class="rank-empty">加载中…</td></tr>';
    if (!info || !info.c) return;
    // 有 BscScan Key 优先走 BscScan（一次请求拿最近 10 条，不限区块跨度）
    if (CONFIG.BSCSCAN_API_KEY) {
      try { return await loadRankingBscScan(); }
      catch (e) { console.warn("[铸造排行榜] BscScan 失败，回退链上查询：", e); }
    }
    await loadRankingChain();
  }

  async function loadRankingBscScan() {
    const addr = info.contract;
    const url = `https://api.bscscan.com/api?module=logs&action=getLogs&address=${addr}`
      + `&topic0=${MINT_TOPIC}&fromBlock=0&toBlock=latest&page=1&offset=10&sort=desc`
      + `&apikey=${CONFIG.BSCSCAN_API_KEY}`;
    const res = await fetch(url);
    const j = await res.json();
    if (j.status !== "1" || !Array.isArray(j.result)) throw new Error(j.message || "BscScan error");
    const rows = j.result.slice(0, 10).map((it) => {
      const parsed = info.c.interface.parseLog({ topics: it.topics, data: it.data });
      const shares = parsed.args.shares;
      return { user: parsed.args.user, shares, amt: shares * info.price, ts: BigInt(it.timeStamp || 0) };
    });
    renderRanking(rows);
  }

  async function loadRankingChain() {
    try {
      const bn = await provider.getBlockNumber();
      // BSC 公共节点对单次 eth_getLogs 的区块跨度有限制，分段查询（每段 1 万块）避免超限
      const STEP = 10000n;
      const MAX_SEG = 200;
      let logs = [];
      let to = bn;
      for (let i = 0; i < MAX_SEG; i++) {
        const from = to - STEP + 1n < 0n ? 0n : to - STEP + 1n;
        let seg = [];
        try { seg = await info.c.queryFilter(info.c.filters.Mint(), from, to); }
        catch (e) { /* 该段受限则跳过，继续往前 */ }
        logs = logs.concat(seg);
        if (logs.length >= 10) break;
        if (to <= STEP) break;
        to = to - STEP;
      }
      const recent = logs.slice(-10).reverse();
      const rows = await Promise.all(recent.map(async (l) => {
        const b = await provider.getBlock(l.blockNumber).catch(() => null);
        const shares = l.args.shares;
        const amt = shares * info.price;
        return { user: l.args.user, shares, amt, ts: b ? b.timestamp : 0n };
      }));
      renderRanking(rows);
    } catch (e) {
      console.warn("[铸造排行榜] 链上查询失败：", e);
      renderRanking(null, "查询失败，请稍后再试");
    }
  }

  function renderRanking(rows, errMsg) {
    const tb = $("rankBody");
    if (!tb) return;
    if (errMsg) {
      tb.innerHTML = `<tr><td colspan="4" class="rank-empty">${errMsg}</td></tr>`;
      return;
    }
    if (!rows || !rows.length) {
      tb.innerHTML = '<tr><td colspan="4" class="rank-empty">暂无铸造记录</td></tr>';
      return;
    }
    tb.innerHTML = rows.map((r, i) => {
      const addr = shortAddr(r.user);
      const time = r.ts ? new Date(Number(r.ts) * 1000).toLocaleString() : "-";
      const amt = ethers.formatUnits(r.amt, info.usdtDec);
      return `<tr><td>${i + 1}</td><td class="rank-addr" title="${r.user}">${addr}</td><td>${time}</td><td>${amt}</td></tr>`;
    }).join("");
  }

  /* ---------- Mint 进度 ---------- */

  function updateProgress() {
    if (!info) return;
    const { mintCount, maxMints, usdtRaised, totalSupply, maxSupply, price, deadline, launched, symbol, usdtDec } = info;
    const pct = maxMints > 0n ? Number((mintCount * 1000n) / maxMints) / 10 : 0;
    const left = maxMints > mintCount ? maxMints - mintCount : 0n;
    const now = BigInt(Math.floor(Date.now() / 1000));

    let cls = "live", txt = t("prog.live");
    if (launched) { cls = "launched"; txt = t("prog.launched"); }
    else if (deadline > 0n && now > deadline) { cls = "ended"; txt = t("prog.ended"); }

    $("prog_bar").style.width = Math.min(100, pct) + "%";
    $("prog_pct").textContent = pct.toFixed(1) + "%";
    $("prog_of").textContent = t("prog.of", { a: String(mintCount), b: String(maxMints) });
    $("prog_status").textContent = txt;
    $("prog_status").className = "status " + cls;
    $("prog_raised").textContent = Number(ethers.formatUnits(usdtRaised, usdtDec)).toLocaleString("en-US") + " " + (info.paySymbol || "USDT");
    const supplyTxt = Number(ethers.formatUnits(totalSupply, 18)).toLocaleString("en-US") + " " + symbol;
    $("prog_supply").textContent = maxSupply > 0n
      ? t("prog.cap", { s: supplyTxt, c: Number(ethers.formatUnits(maxSupply, 18)).toLocaleString("en-US") })
      : supplyTxt;
    $("prog_left").textContent = String(left);
    $("prog_deadline").textContent = launched
      ? t("prog.done")
      : (deadline > 0n ? new Date(Number(deadline) * 1000).toLocaleString(LANG === "zh" ? "zh-CN" : "en-US", { hour12: false }) : "未设定");
  }

  /* ---------- 资格检查 ---------- */

  function row(ok, label, extra) {
    return `<div class="row ${ok ? "ok" : "bad"}"><i>${ok ? "✓" : "✗"}</i><b>${label}</b><span>${extra || ""}</span></div>`;
  }

  function renderRows() {
    if (!lastCheck) return;
    const d = lastCheck;
    const rows = [
      row(true, t("el.addr"), d.a),
      ...(d.name ? [row(true, t("el.name", { n: d.name }), t("el.resolved"))] : []),
      row(Number(d.nftBal) > 0, t("el.nft", { n: String(d.nftBal) }), Number(d.nftBal) > 0 ? "" : t("el.nftBad")),
      row(d.payBal >= d.need, t("el.payBal", { sym: d.paySymbol, v: d.fmtU(d.payBal) }), t("el.payNeed", { sym: d.paySymbol, v: d.fmtU(d.need) })),
      row(d.bnb > 0n, t("el.bnb", { v: Number(ethers.formatEther(d.bnb)).toFixed(5) }), t("el.bnbNeed")),
      row(!d.launched, d.launched ? t("el.launched") : t("el.notLaunched"), t("el.progress", { a: String(d.mintCount), b: String(d.maxMints) })),
      row(d.left >= d.count, t("el.quota", { n: String(d.left) }),
        t("el.quotaSub", { m: String(d.maxPerWallet), u: String(d.minted) }) +
        (Number(d.refBonus) > 0 ? (LANG === "zh" ? " · 推广加成 +" + d.refBonus + " 份" : " · referral +" + d.refBonus) : "")),
      row(d.deadline > d.now, d.deadline > d.now ? t("el.deadlineOk") : t("el.deadlineBad"), new Date(d.deadline * 1000).toLocaleString()),
      ...(d.nativePay ? [] : [row(d.allowance >= d.need, t("el.allow", { v: d.fmtU(d.allowance), sym: d.paySymbol }), d.allowance >= d.need ? t("el.allowSkip") : t("el.allowNeed"))]),
    ];
    $("elig").innerHTML = rows.join("");
    $("elig").classList.add("show");
  }

  async function check() {
    const r = await ensureResolved();
    if (!r) return;
    const a = r.addr;
    $("elig").classList.add("show");
    $("elig").innerHTML = row(false, t("el.loading"), "");
    try {
      const i = info || (await loadInfo());
      const count = selectedCount;
      const need = i.price * BigInt(count);
      const nft = new ethers.Contract(i.nft, ["function balanceOf(address) view returns (uint256)"], provider);

      const [nftBal, usdtBal, bnb, minted, refBonus, allowance] = await Promise.all([
        nft.balanceOf(a),
        i.nativePay ? 0n : i.u.balanceOf(a),
        provider.getBalance(a),
        i.c.mintedShares(a), i.c.referralBonus(a),
        i.nativePay ? 0n : i.u.allowance(a, i.contract),
      ]);

      const fmtU = (v) => Number(ethers.formatUnits(v, Number(i.usdtDec))).toLocaleString("en-US", { maximumFractionDigits: 6 });
      const userMax = Number(i.maxPerWallet) + Number(refBonus); // 基础上限 + 推广加成
      const payBal = i.nativePay ? bnb : usdtBal;
      lastCheck = {
        a, name: r.name, count, need, nftBal, usdtBal, payBal, bnb, minted, refBonus, allowance, fmtU,
        nativePay: i.nativePay, paySymbol: i.paySymbol || "USDT",
        launched: i.launched, mintCount: i.mintCount, maxMints: i.maxMints,
        basePerWallet: Number(i.maxPerWallet), maxPerWallet: userMax,
        left: userMax - Number(minted), deadline: Number(i.deadline), now: Math.floor(Date.now() / 1000),
      };
      renderRows();
      toast(t("t.checkDone"), "ok");
    } catch (e) {
      $("elig").innerHTML = row(false, t("el.fail"), e.shortMessage || e.message);
      toast(t("t.readFail") + (e.shortMessage || e.message), "err");
    }
  }

  /* ---------- 生成 AI 指令 ---------- */

  function buildCommand() {
    const count = selectedCount;
    const cAddr = ethers.getAddress($("contract").value.trim());
    const nativePay = info ? !!info.nativePay : false;
    const paySymbol = (info && info.paySymbol) || "USDT";
    const dec = info ? Number(info.usdtDec) : 18;
    const price = info ? BigInt(info.price) : ethers.parseUnits("1", dec);
    const perMint = info ? Number(ethers.formatUnits(info.perMint, 18)).toLocaleString("en-US") : "21,000";
    const shares = BigInt(count);
    const cost = price * shares; // 实际花费
    const maxCost = (cost * 110n) / 100n; // 授权与 maxCost 都按 1.1 倍留余量（AI 执行前会用实时 PRICE 重算）
    const amountText = Number(ethers.formatUnits(maxCost, dec)).toLocaleString("en-US", { maximumFractionDigits: 6 });
    const costText = Number(ethers.formatUnits(cost, dec)).toLocaleString("en-US", { maximumFractionDigits: 6 });
    const priceText = Number(ethers.formatUnits(price, dec)).toLocaleString("en-US", { maximumFractionDigits: 6 });
    const name = info && info.name ? info.name : CHAIN_NAME;
    const totalText = Number(ethers.formatUnits(BigInt(info ? info.perMint : 0n) * shares, 18)).toLocaleString("en-US");

    const uAddr = !nativePay ? ethers.getAddress($("usdt").value.trim()) : "";
    const approveData = "0x095ea7b3" + ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [cAddr, maxCost]).slice(2);
    // mint(shares, referrer, maxCost) —— 一次交易买 count 份，不分多次（原生 BNB 时通过交易 value 付 maxCost）
    const mintData = MINT_SIG + ethers.AbiCoder.defaultAbiCoder()
      .encode(["uint256", "address", "uint256"], [shares, defaultReferrer, maxCost]).slice(2);

    // 按付款方式生成命令片段
    const mintStepLabel = nativePay
      ? (LANG === "zh" ? "第 1 笔" : "Tx 1")
      : (LANG === "zh" ? "第 2 笔" : "Tx 2");
    const mintValueArg = nativePay ? ` --value ${amountText} ${paySymbol}` : "";
    const approveBlock = nativePay ? "" : (LANG === "zh"
      ? `第 1 笔：给 mint 合约授权 maxCost ${paySymbol}（授权额度已够可跳过）\n  合约（${paySymbol}）: ${uAddr}\n  approve(spender = ${cAddr}, amount = maxCost ${paySymbol})\n  调用数据: ${approveData}\n  baw contract-call preview --binanceChainId ${CHAIN_ID} --to ${uAddr} --inputData ${approveData} --json\n\n`
      : `Tx 1: approve maxCost ${paySymbol} to the mint contract (skip if allowance is already enough)\n  ${paySymbol} contract: ${uAddr}\n  approve(spender = ${cAddr}, amount = maxCost ${paySymbol})\n  Input data: ${approveData}\n  baw contract-call preview --binanceChainId ${CHAIN_ID} --to ${uAddr} --inputData ${approveData} --json\n\n`);
    const payNote = nativePay
      ? (LANG === "zh"
          ? `绝不能直接把 ${paySymbol} 转给 mint 合约；铸造以交易 value 支付 ${paySymbol}，只有 ${cAddr} 收款。`
          : `Never send ${paySymbol} directly to the mint contract. Payment is made via the transaction value; ${cAddr} is the only address that accepts payment.`)
      : (LANG === "zh"
          ? `绝不能直接把 ${paySymbol} 转到 mint 合约；只有 ${cAddr} 收款。`
          : `Never transfer ${paySymbol} directly to the mint contract. ${cAddr} is the only address that accepts payment.`);

    const idLine = "";
    const vars = {
      chain: String(CHAIN_ID), idLine, amountText, uAddr, approveData,
      cAddr, mintData, mintSig: MINT_SIG, count: String(count), priceText,
      costText, totalText, perMint, name, ref: defaultReferrer,
      approveBlock, mintStepLabel, mintValueArg, payNote, paySymbol,
    };

    return t("cmd.body", vars);
  }

  async function generate() {
    try {
      await loadInfo();
    } catch {}
    const cmd = buildCommand();
    if (!cmd) return;
    $("cmd").value = cmd;
    // 生成即复制：用户只要粘给自己的 AI 代理（baw CLI）就行
    try {
      await navigator.clipboard.writeText(cmd);
      toast(t("t.genCopied"), "ok");
    } catch {
      $("cmd").select();
      toast(t("t.genOk"), "ok");
    }
  }

  /* ---------- 连接币安钱包 ---------- */

  // 币安登录页；return_to 用 base64 编码当前页面，登录后自动跳回
  const BINANCE_LOGIN = "https://accounts.binance.com/en/login";

  // WalletConnect projectId：页面里填的优先（存本机），没填就用下面这个默认值
  const WC_PID_KEY = "agt_wc_pid";
  const DEFAULT_WC_PID = "d1d20d01deca8b04d0c243954db38bd8";
  function wcProjectId() {
    return (localStorage.getItem(WC_PID_KEY) || DEFAULT_WC_PID).trim();
  }

  function binanceLoginUrl() {
    let back = "";
    try {
      back = btoa(location.href);
    } catch {}
    return back ? `${BINANCE_LOGIN}?return_to=${encodeURIComponent(back)}` : BINANCE_LOGIN;
  }

  /* 只认币安钱包，与 jager.live 的检测方式完全一致：
     ① EIP-6963 公告里 rdns 含 "binance" 的 provider（最规范，能同时装多个钱包也不混淆）
     ② window.ethereum.isBinance / window.BinanceChain（币安钱包插件）
     ③ window.binancew3w.ethereum（币安 App 内置浏览器）
     小狐狸等其他钱包一律不用，避免点了「连接币安钱包」却弹 MetaMask。 */
  const eip6963 = [];
  window.addEventListener("eip6963:announceProvider", (e) => {
    if (e && e.detail && e.detail.info && e.detail.provider) eip6963.push(e.detail);
  });

  // 是否在币安 App 内核里打开（App 的浏览器 UA 通常带 Binance）
  function inBinanceApp() {
    return /Binance|binancew3w|bnbweb3/i.test(navigator.userAgent) || !!(window.binancew3w);
  }

  function injectedWallet() {
    const binance = eip6963.filter((d) => String((d.info && d.info.rdns) || "").toLowerCase().includes("binance"));
    if (binance.length) return binance[0].provider;
    const e = window.ethereum;
    if (e && (e.isBinance || e.isBinanceWeb3Wallet || e.isBinanceW3W)) return e;
    if (window.BinanceChain) return window.BinanceChain;
    if (window.binancew3w && window.binancew3w.ethereum) return window.binancew3w.ethereum;
    // 兜底：确实在币安 App 里，但钱包没打标记 —— 那 window.ethereum 就是币安钱包，直接用它，
    // 免得识别不到就跑去走扫码（relay 不通时永远连不上）
    if (inBinanceApp() && e) return e;
    return null;
  }

  // 环境诊断：把浏览器里真实存在的钱包对象列出来，便于定位"连不上"
  function diagInfo() {
    const e = window.ethereum;
    const L = [];
    L.push("URL: " + location.href);
    L.push("UA: " + navigator.userAgent);
    L.push("在币安 App 内: " + (inBinanceApp() ? "是" : "否"));
    L.push("window.ethereum: " + (e ? "有" : "无"));
    if (e) {
      L.push("  isMetaMask=" + !!e.isMetaMask + " isBinance=" + !!e.isBinance + " isBinanceW3W=" + !!e.isBinanceW3W + " isCoinbaseWallet=" + !!e.isCoinbaseWallet);
    }
    L.push("window.BinanceChain: " + (window.BinanceChain ? "有" : "无"));
    L.push("window.binancew3w: " + (window.binancew3w && window.binancew3w.ethereum ? "有" : "无"));
    L.push(
      "EIP-6963: " +
        (eip6963.length ? eip6963.map((d) => (d.info && d.info.rdns) + " / " + (d.info && d.info.name)).join(" ; ") : "无")
    );
    L.push("WCMint(vendor/wc.js): " + (window.WCMint ? "已加载" : "未加载"));
    L.push("projectId: " + (wcProjectId() || "空"));
    L.push("injectedWallet(): " + (injectedWallet() ? "有 → 会直接弹钱包" : "无 → 会走扫码/WC"));
    return L.join("\n");
  }

  // 连接入口：先弹「选择连接方式」（Agentic 扫码 / 浏览器钱包），再按选择走对应流程
  function connect() {
    const m = $("walletModal");
    if (m) m.classList.remove("hidden");
  }

  function closeWalletChooser() {
    const m = $("walletModal");
    if (m) m.classList.add("hidden");
  }

  async function connectAgenticRoute() {
    closeWalletChooser();
    if (agentApiUrl()) return connectAgentic();
    return connectWC(); // 没有 Agentic API → 退化为 WalletConnect 扫码连币安 App
  }

  // 浏览器注入式钱包（TP / MetaMask / 币安插件等）：用于读地址、资格检查与推广链接。
  // 注意：真正的「用币安 AI 钱包铸造」仍走 Agentic 流程，这里只负责连接与查询。
  async function connectBrowserWallet() {
    closeWalletChooser();
    const w = injectedWallet() || (eip6963[0] && eip6963[0].provider) || window.ethereum;
    if (!w) {
      connMsg(t("wc.noInjected"), true);
      toast(t("wc.noInjected"), "err");
      return;
    }
    connMsg(t("wc.connecting"));
    try {
      const accs = await w.request({ method: "eth_requestAccounts" });
      walletProvider = w;
      setAccount(accs[0]);
      connMsg(t("wc.connected") + " " + shortAddr(accs[0]));
      toast(t("t.walletOk"), "ok");
    } catch (e) {
      connMsg(t("t.connectFail") + "：" + ((e && (e.shortMessage || e.message)) || ""), true);
      toast(e.message || t("t.connectFail"), "err");
    }
  }

  // WalletConnect 扫码连币安 App（无 Agentic API 时的兜底）
  async function connectWC() {
    // 不调用浏览器注入式钱包（避免误连 MetaMask 等）；直接走 WalletConnect 扫码连币安 App
    const W = window.WCMint;
    if (W && W.EthereumProvider) {
      const pid = wcProjectId();
      if (!pid) {
        showUrlQr(); // 没配 projectId 也要有码可扫：改成「网址码」在币安 App 内打开
        toast(t("wc.needId"), "err");
        return;
      }
      try {
        connMsg(t("wc.connecting"));
        toast(t("wc.connecting"));
        let gotUri = false;
        // 6 秒还没拿到配对码 → 不再干等，直接给「网址码」（币安 App 扫码即在 App 内打开本站）
        const slow = setTimeout(() => {
          if (!gotUri) showUrlQr();
        }, 6000);
        const clearSlow = () => clearTimeout(slow);
        wcProvider = await W.EthereumProvider.init({
          projectId: pid,
          chains: [CHAIN_ID],
          optionalChains: [CHAIN_ID],
          showQrModal: false,
          methods: ["eth_sendTransaction", "eth_requestAccounts", "eth_accounts", "eth_chainId", "wallet_switchEthereumChain"],
          events: ["chainChanged", "accountsChanged"],
        });
        wcProvider.on("display_uri", (arg) => {
          // 不同版本的 SDK 这里可能给字符串，也可能给对象，统一取出字符串
          let uri = typeof arg === "string" ? arg : arg && (arg.uri || arg.data || arg.params);
          if (uri && typeof uri !== "string") uri = String(uri.uri || uri.data || uri);
          gotUri = true;
          clearSlow();
          showQr(uri || "");
        });
        const accs = await wcProvider.request({ method: "eth_requestAccounts" });
        clearSlow();
        closeQr();
        const badge = $("awBadge");
        if (badge) {
          badge.textContent = t("wc.badgeOk");
          badge.classList.add("ok");
        }
        walletProvider = wcProvider;
        setAccount(accs[0]);
        connMsg(t("wc.connected") + " " + shortAddr(accs[0]));
        toast(t("wc.connected"), "ok");
      } catch (e) {
        clearSlow();
        closeQr();
        const msg = (e && (e.shortMessage || e.message)) || t("t.connectFail");
        connMsg(t("t.connectFail") + "：" + msg, true);
        toast(msg, "err");
      }
      return;
    }

    // 都没有 → 提示改用币安 App 内打开（交易所登录页连不到钱包，不再误导用户跳转）
    connMsg(t("wc.noWay"), true);
    toast(t("wc.noWay"), "err");
  }

  /* GitHub Pages 通过自有 Render API 接入官方 baw CLI：二维码、会话和交易确认均由币安 App 完成。 */
  let agenticSession = "";
  let qrAborted = false; // 取消扫码登录时为 true，pending 的 confirm 轮询回来即丢弃

  // 把节点返回的 revert 数据解码成人话（Error(string)=0x08c379a0 / Panic=0x4e487b71）
  function decodeRevert(data) {
    try {
      if (typeof data !== "string" || !data.startsWith("0x")) return "";
      if (data.startsWith("0x08c379a0")) {
        return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
      }
      if (data.startsWith("0x4e487b71")) {
        const code = BigInt("0x" + data.slice(10));
        const panic = { 1: "assert 失败", 17: "算术溢出", 18: "除零" };
        return "Panic(" + (panic[code] || code.toString()) + ")";
      }
    } catch {}
    return "";
  }

  // 直接打公共 BSC RPC：错误不再被 ethers 包装成 "could not coalesce error"，真实原因直接抛出
  async function rpcCall(method, params) {
    let lastMsg = "";
    let lastData = "";
    for (const rpc of RPCS) {
      try {
        const response = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        const json = await response.json();
        if (!json.error) return json.result;
        lastMsg = (json.error && json.error.message) || "";
        lastData = typeof (json.error && json.error.data) === "string" ? json.error.data : "";
        if (lastData) break; // 带 revert 数据的是确定性错误，换节点结果一样
      } catch (e) { lastMsg = String((e && e.message) || e); }
    }
    const reason = decodeRevert(lastData);
    if (reason) throw new Error("合约拒绝: " + reason);
    if (/revert/i.test(lastMsg)) throw new Error("合约拒绝: " + lastMsg);
    throw new Error(method + " 请求失败: " + (lastMsg || "所有 BSC 公共节点均不可用"));
  }
  function agentApiUrl() {
    return (document.querySelector('meta[name="agent-wallet-api"]')?.content || "").trim().replace(/\/$/, "");
  }
  async function agentCall(action, extra = {}) {
    const r = await fetch(agentApiUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sessionId: agenticSession, ...extra }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || "Agentic Wallet request failed");
    return j;
  }
  function nested(obj, keys) {
    if (!obj || typeof obj !== "object") return null;
    for (const key of keys) if (typeof obj[key] === "string" && obj[key]) return obj[key];
    for (const value of Object.values(obj)) { const found = nested(value, keys); if (found) return found; }
    return null;
  }
  function saveAgenticLogin(obj) {
    try { localStorage.setItem("agentic_login", JSON.stringify(obj)); } catch {}
  }
  function clearAgenticLogin() {
    try { localStorage.removeItem("agentic_login"); } catch {}
  }
  function readAgenticLogin() {
    try { return JSON.parse(localStorage.getItem("agentic_login")); } catch { return null; }
  }

  // 币安 Agentic Wallet 的登录态默认只活在 JS 内存里：手机切到币安 App 再返回，
  // 浏览器标签页会被后台冻结甚至重载，内存里的会话（含等待中的 confirm 长轮询）随之丢失，
  // 于是「返回网页不显示登录」。把会话存进 localStorage，页面加载时自动恢复即可解决。
  function buildAgenticProvider(address) {
    return {
      async request({ method, params = [] }) {
        if (method === "eth_chainId") return "0x38";
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
        if (["eth_blockNumber", "eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_call", "eth_getBalance"].includes(method)) {
          return rpcCall(method, params);
        }
        if (method === "eth_sendTransaction") {
          const tx = params[0];
          const preview = await agentCall("preview", { tx: { from: address, to: tx.to, value: tx.value || "0", inputData: tx.data || "0x" } });
          const requestId = nested(preview.result, ["requestId"]);
          if (!requestId) throw new Error("交易预览未返回 requestId");
          const executed = await agentCall("execute", { requestId });
          const hash = nested(executed.result, ["txHash", "transactionHash", "hash"]);
          if (!hash) throw new Error("等待币安 App 确认交易");
          return hash;
        }
        if (method.startsWith("eth_")) {
          return rpcCall(method, params);
        }
        throw new Error("Unsupported wallet method: " + method);
      },
    };
  }

  function showAgenticQr({ url, pair }) {
    const box = $("qrBox");
    if (box) box.innerHTML = window.WCMint?.qrSvg ? window.WCMint.qrSvg(url) : url;
    $("qrMode").textContent = "用币安 App 扫码，核对配对码后确认登录。";
    $("awPair").textContent = pair || "——";
    $("wcOpen").href = url; $("wcOpen").textContent = "打开币安登录";
    $("qrModal").classList.remove("hidden");
    $("awWait").textContent = "等待币安 App 扫码并确认…";
  }

  // 等待币安 App 确认（长轮询 confirm）。成功则连上；用户取消或会话失效则抛错。
  async function waitAgenticConfirm(qrCodeId) {
    const verified = await agentCall("confirm", { qrCodeId });
    if (qrAborted) throw new Error("已取消登录");
    const wallet = await agentCall("wallet");
    const address = wallet.address;
    agenticProvider = buildAgenticProvider(address);
    closeQr(); walletProvider = agenticProvider; setAccount(address);
    connMsg("Agentic Wallet 已连接 " + shortAddr(address)); toast(t("t.walletOk"), "ok");
  }

  // 页面加载时静默恢复登录态：手机从币安 App 返回后（即使标签页被重载），
  // 若已在 App 端确认过，这里会立即连上；若还没确认，则重新亮出二维码让用户继续扫。
  async function restoreAgenticSession() {
    if (!agentApiUrl() || walletProvider || account) return;
    const saved = readAgenticLogin();
    if (!saved || !saved.sessionId || !saved.qrCodeId) return;
    agenticSession = saved.sessionId;
    showAgenticQr(saved);
    try {
      await waitAgenticConfirm(saved.qrCodeId);
    } catch (e) {
      if (!qrAborted) clearAgenticLogin();
      closeQr();
      connMsg("上次的登录会话已失效，请重新点击「连接钱包」。", true);
    }
  }

  async function connectAgentic() {
    try {
      qrAborted = false;
      connMsg("正在获取币安 Agentic Wallet 登录二维码…");
      const login = await agentCall("login");
      agenticSession = login.sessionId;
      const data = login.result || {};
      const url = nested(data, ["urlForWeb", "qrCodeUrl"]);
      const qrCodeId = nested(data, ["qrCodeId"]);
      const pair = nested(data, ["pairingCode"]);
      if (!url || !qrCodeId) throw new Error("未收到币安登录二维码");
      saveAgenticLogin({ sessionId: agenticSession, qrCodeId, url, pair });
      showAgenticQr({ url, pair });
      await waitAgenticConfirm(qrCodeId);
    } catch (e) {
      clearAgenticLogin();
      closeQr(); connMsg("Agentic Wallet 连接失败：" + (e.message || e), true); toast(e.message || "连接失败", "err");
    }
  }
  let agenticProvider = null;

  // 连接状态常驻显示（失败原因不再是一闪而过的 toast）
  function connMsg(text, isErr) {
    const el = $("connMsg");
    if (!el) return;
    el.innerHTML = text ? `<span class="${isErr ? "err" : ""}">${text}</span>` : "";
  }

  function setAccount(addr) {
    account = addr;
    if ($("addr")) $("addr").value = addr;
    resolved = { addr, name: null };
    const short = shortAddr(addr);
    const cb = $("connectBtn");
    if (cb) cb.textContent = short;
    const tcb = $("topConnectBtn");
    if (tcb) tcb.innerHTML = short + ' <span class="arrow">↗</span>';
    const tst = $("topWalletStatus");
    if (tst) { tst.textContent = "钱包已连接"; tst.classList.add("ok"); }
    const acs = $("acStatus");
    if (acs) { acs.textContent = "已连接 · " + short; acs.classList.add("ok"); }
    refreshWallet();
  }

  // 连接钱包后展示：剩余可 Mint 次数（基础 + 推广）与专属推广链接
  async function refreshWallet() {
    if (!account) return;
    const panel = $("walletPanel");
    if (panel) panel.classList.remove("hidden");
    const body = $("wpBody");
    if (body) body.classList.remove("hidden");
    const hint = $("wpHint");
    if (hint) hint.classList.add("hidden");
    const addrEl = $("wpAddr");
    if (addrEl) addrEl.textContent = shortAddr(account);
    const link = location.origin + location.pathname + "?ref=" + account;
    const linkEl = $("wpLink");
    if (linkEl) linkEl.value = link;
    const leftEl = $("wpLeft");
    try {
      const i = info || (await loadInfo());
      const [minted, refBonus] = await Promise.all([
        i.c.mintedShares(account), i.c.referralBonus(account),
      ]);
      const base = Number(i.maxPerWallet);
      const userMax = base + Number(refBonus);
      const left = Math.max(0, userMax - Number(minted));
      if (leftEl) leftEl.textContent = LANG === "zh"
        ? left + " 次（基础 " + base + " + 推广 " + Number(refBonus) + "）"
        : left + " (base " + base + " + referral " + Number(refBonus) + ")";
      const quotaEl = $("payQuota");
      if (quotaEl) quotaEl.textContent = left + " / " + userMax;
    } catch (e) {
      if (leftEl) leftEl.textContent = "—";
    }
  }

  let lastUri = ""; // 最近一次 WC 连接串，用于「打开币安 App」按钮

  function wcOpenUrl(uri) {
    return "https://walletconnect.com/wc?uri=" + encodeURIComponent(uri);
  }

  function showQr(uri) {
    lastUri = uri;
    const ok = typeof uri === "string" && uri.indexOf("wc:") === 0;
    const box = $("qrBox");
    if (box) {
      if (ok && window.WCMint && window.WCMint.qrSvg) {
        try {
          box.innerHTML = window.WCMint.qrSvg(uri);
        } catch {
          box.textContent = uri;
        }
      } else {
        // 连接串不对就不画码，直接把原文露出来，方便定位
        box.innerHTML = `<span class="err">连接串异常（不是有效的 wc: 连接串）：<br>${String(uri).slice(0, 300)}</span>`;
        connMsg(t("wc.badUri") + "：" + String(uri).slice(0, 80), true);
      }
    }
    const open = $("wcOpen");
    if (open) {
      open.href = ok ? wcOpenUrl(uri) : "#";
      open.textContent = t("wc.openApp");
    }
    const mode = $("qrMode");
    if (mode) mode.textContent = ok ? t("wc.qrModeWc") : t("wc.badUri");
    const m = $("qrModal");
    if (m) m.classList.remove("hidden");
    // 配对码（jager 同款）：取 WC 会话 topic 前 6 位，币安 App 端会显示同样的码供比对
    const tm = ok ? uri.match(/^wc:([0-9a-fA-F]+)@/) : null;
    const pair = $("awPair");
    if (pair) pair.textContent = tm ? tm[1].slice(0, 6).toUpperCase() : "——";
    const badge = $("awBadge");
    if (badge) {
      badge.textContent = t("wc.badgeConnecting");
      badge.classList.remove("ok");
    }
    connMsg(t("wc.qrReady"));
    startWaitTimer();
    // 手机浏览器：自动开新标签唤起币安 App 授权（不卸载本页，连接状态才不会丢）
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && String(uri).startsWith("wc:")) {
      try {
        window.open(wcOpenUrl(uri), "_blank");
      } catch {}
    }
  }

  /* 兜底二维码：把本站网址做成码。
     币安 App 扫完就在 App 内打开本站 —— App 内置浏览器自带钱包注入，
     因此不需要 WalletConnect、不需要 projectId，任何网络环境都能用。 */
  function showUrlQr() {
    const url = location.href.split("#")[0];
    const box = $("qrBox");
    if (box) {
      try {
        box.innerHTML = window.WCMint && window.WCMint.qrSvg ? window.WCMint.qrSvg(url) : url;
      } catch {
        box.textContent = url;
      }
    }
    const mode = $("qrMode");
    if (mode) mode.textContent = t("wc.qrModeUrl");
    const pair = $("awPair");
    if (pair) pair.textContent = "——";
    const open = $("wcOpen");
    if (open) {
      open.href = url;
      open.textContent = t("wc.openSite");
    }
    const m = $("qrModal");
    if (m) m.classList.remove("hidden");
    const badge = $("awBadge");
    if (badge) {
      badge.textContent = t("wc.badgeConnecting");
      badge.classList.remove("ok");
    }
    startWaitTimer();
  }

  // 「正在等待币安 App · Ns」计时器（对齐 jager）
  let waitTimer = null;
  let waitStart = 0;

  function startWaitTimer() {
    stopWaitTimer();
    waitStart = Date.now();
    const el = $("awWait");
    if (!el) return;
    const tick = () => {
      el.textContent = `${t("wc.waiting")} · ${Math.floor((Date.now() - waitStart) / 1000)}s`;
    };
    tick();
    waitTimer = setInterval(tick, 1000);
  }

  function stopWaitTimer() {
    if (waitTimer) {
      clearInterval(waitTimer);
      waitTimer = null;
    }
    const el = $("awWait");
    if (el) el.textContent = "";
  }

  function closeQr() {
    qrAborted = true;
    const m = $("qrModal");
    if (m) m.classList.add("hidden");
    stopWaitTimer();
  }

  /* ---------- 网页直接铸造（钱包签名） ---------- */

  async function mintWithWallet() {
    const wtx0 = $("wtx");
    // 失败原因不只弹 toast，也写在按钮下方，避免"点了没反应"
    const fail = (msg) => {
      toast(msg, "err");
      if (wtx0) wtx0.innerHTML = `<span class="err">${msg}</span>`;
    };

    // 没连钱包就先连（弹「选择连接方式」），连接成功后再点一次铸造
    if (!walletProvider) {
      toast(t("wc.connectingFirst"));
      await connect();
      return;
    }
    if (!info) {
      try {
        await loadInfo();
      } catch (e) {
        return fail(t("wc.needInfo"));
      }
    }
    if (!info) return fail(t("wc.needInfo"));

    const bp = new ethers.BrowserProvider(walletProvider);
    const net = await bp.getNetwork();
    if (Number(net.chainId) !== CHAIN_ID) return fail(t("t.wrongChain"));

    const signer = await bp.getSigner();
    const from = await signer.getAddress();
    const shares = BigInt(selectedCount);
    const cost = BigInt(info.price) * shares;
    const maxCost = (cost * 110n) / 100n; // 与 AI 指令一致：1.1 倍余量
    const cAddr = ethers.getAddress($("contract").value.trim());
    const uAddr = ethers.getAddress($("usdt").value.trim());
    const wtx = $("wtx");

    try {
      // 1) 授权（额度够就跳过）
      const u = new ethers.Contract(uAddr, ["function allowance(address,address) view returns (uint256)"], bp);
      const allowance = await u.allowance(from, cAddr);
      if (allowance < maxCost) {
        toast(t("t.approving"));
        const tx1 = await signer.sendTransaction({
          to: uAddr,
          data: "0x095ea7b3" + ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [cAddr, maxCost]).slice(2),
        });
        await tx1.wait();
        toast(t("t.approveOk"), "ok");
        if (wtx) wtx.innerHTML = txLink(t("tx.approve"), tx1.hash);
      }

      // 2) 铸造（新版一笔买完；旧版无参 mint()，每笔 1 份，逐笔发）
      toast(t("t.minting"));
      const ver = info.mintVer === "shares" ? "shares" : "single";
      const newData = MINT_SIG + ethers.AbiCoder.defaultAbiCoder()
        .encode(["uint256", "address", "uint256"], [shares, defaultReferrer, maxCost]).slice(2);
      const times = ver === "shares" ? 1 : Number(shares);
      const hashes = [];
      let gasUsed = 0n;
      for (let i = 0; i < times; i++) {
        if (i > 0) toast(`${t("t.minting")} (${i + 1}/${times})`);
        const tx2 = await signer.sendTransaction({ to: cAddr, data: ver === "shares" ? newData : MINT_SIG_LEGACY });
        const rc = await tx2.wait();
        hashes.push(tx2.hash);
        gasUsed += rc.gasUsed;
      }
      toast(t("t.mintOk"), "ok");
      if (wtx) {
        wtx.className = "hint tx-success";
        wtx.innerHTML =
          hashes
            .map((h, i) => `<div class="tx-row">✅ ${times > 1 ? t("tx.mint") + " " + (i + 1) : t("tx.mint")}：<a href="https://bscscan.com/tx/${h}" target="_blank" rel="noopener">${shortAddr(h)}</a></div>`)
            .join("") +
          `<div class="tx-gas">⛽ ${t("tx.gas")}: ${gasUsed}</div>`;
      }
      loadInfo().catch(() => {});
    } catch (e) {
      // ethers 会把底层错误包装成 "could not coalesce error"，真实原因在 info.error 里，挖出来直接显示
      const nested = e && ((e.info && e.info.error) || e.error);
      const real = (nested && nested.message) || e.shortMessage || e.reason || e.message || t("t.mintFail");
      fail(String(real));
    }
  }

  function txLink(label, hash) {
    return `<a href="https://bscscan.com/tx/${hash}" target="_blank" rel="noopener">${label} ${shortAddr(hash)}</a>`;
  }

  async function copyCmd() {
    const v = $("cmd").value;
    if (!v) return toast(t("t.genFirst"), "err");
    try {
      await navigator.clipboard.writeText(v);
      toast(t("t.copyOk"), "ok");
    } catch {
      $("cmd").select();
      toast(t("t.copyFail"), "err");
    }
  }

  /* ---------- 绑定 ---------- */

  $("langBtn").addEventListener("click", () => applyLang(LANG === "zh" ? "en" : "zh"));

  // 窗口尺寸变化时重新填满滚动条，避免空白
  let _rz;
  window.addEventListener("resize", () => {
    clearTimeout(_rz);
    _rz = setTimeout(fillTicker, 200);
  });

  // 按钮可能不存在（老页面），加个空判断避免整个脚本挂掉
  const _connectBtn = $("connectBtn");
  if (_connectBtn) _connectBtn.addEventListener("click", connect);

  // 右上角连接钱包按钮（复用同一套 connect 逻辑）
  const _topConnectBtn = $("topConnectBtn");
  if (_topConnectBtn) _topConnectBtn.addEventListener("click", connect);
  // 连接方式选择弹层
  const _wlAgentic = $("wlAgentic");
  if (_wlAgentic) _wlAgentic.addEventListener("click", connectAgenticRoute);
  const _wlBrowser = $("wlBrowser");
  if (_wlBrowser) _wlBrowser.addEventListener("click", connectBrowserWallet);
  const _wlCancel = $("wlCancel");
  if (_wlCancel) _wlCancel.addEventListener("click", closeWalletChooser);

  // PAY WITH 代币切换（视觉高亮，铸造仍以 USDT 为准）
  document.querySelectorAll(".pw-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".pw-opt").forEach((x) => x.classList.remove("active"));
      opt.classList.add("active");
    });
  });

  // 取消按钮不能用内联 onclick（app.js 是 IIFE，closeQr 不是全局函数），必须在这里绑定
  const _qrCancel = $("qrCancel");
  if (_qrCancel) _qrCancel.addEventListener("click", () => { clearAgenticLogin(); closeQr(); });


  // 环境提示：告诉用户当前浏览器能不能直接连币安钱包
  (function envHint() {
    const eg = window.ethereum;
    const hasBinance =
      !!injectedWallet() ||
      !!(eg && (eg.isBinance || eg.isBinanceWeb3Wallet || eg.isBinanceW3W)) ||
      !!window.BinanceChain ||
      !!(window.binancew3w && window.binancew3w.ethereum);
    const other = !!eg && !hasBinance;
    const h1 = $("hintNoBinance");
    const h2 = $("hintScan");
    if (h1) h1.classList.toggle("hidden", !other);
    if (h2) h2.classList.toggle("hidden", hasBinance || other);
  })();

  // 复制本站网址，方便粘到币安 App 里打开（App 内即可直接连钱包铸造）
  if ($("copyLinkBtn"))
    $("copyLinkBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        toast(t("wc.copyLinkOk"), "ok");
      } catch {
        toast(location.href, "ok");
      }
    });

  // 让已安装的钱包通过 EIP-6963 主动上报，稍后 connect() 才能找到它
  try {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch {}
  // 钱包广播是异步的，稍后再刷新一次诊断
  setTimeout(renderDiag, 600);

  // 诊断面板
  function renderDiag() {
    const el = $("diag");
    if (el) el.textContent = diagInfo();
  }
  if ($("diagCopy"))
    $("diagCopy").addEventListener("click", async () => {
      renderDiag();
      try {
        await navigator.clipboard.writeText(diagInfo());
      } catch {}
      toast(t("wc.diagCopied"), "ok");
    });
  if ($("diagReload")) $("diagReload").addEventListener("click", renderDiag);
  renderDiag();

  // （旧版裸 WS 探测已移除：握手方式与 SDK 不同，结果会误报）

  // 「测试连接服务」：用真实的 WalletConnect SDK 走一遍完整握手 —— 结果只有三种，都能定位问题
  if ($("netTest"))
    $("netTest").addEventListener("click", async () => {
      const out = $("netOut");
      if (!out) return;
      out.classList.remove("hidden");
      const pid = wcProjectId() || "";
      if (!window.WCMint || !window.WCMint.EthereumProvider) {
        out.textContent = "✗ vendor/wc.js 未加载（刷新或检查该文件是否已上传）";
        return;
      }
      out.textContent = t("wc.netTesting");
      let p;
      try {
        p = await window.WCMint.EthereumProvider.init({
          projectId: pid,
          chains: [CHAIN_ID],
          optionalChains: [CHAIN_ID],
          showQrModal: false,
          metadata: { name: "diag", description: "diag", url: location.origin, icons: [] },
        });
      } catch (e) {
        out.textContent = "✗ 连不上中继（网络问题）：" + ((e && e.message) || e);
        return;
      }
      // init 成功 = 中继已连上，网络没问题；接下来看 projectId 是否被接受
      out.textContent = t("wc.netRelayOk");
      let got = false;
      p.on("display_uri", (uri) => {
        got = true;
        out.textContent = "✓ 全部正常：projectId 有效，已拿到配对 URI\n" + String(uri).slice(0, 64) + "…\n（说明扫码连接可用，问题在别处）";
      });
      p.connect().catch((e) => {
        if (!got) out.textContent = "✗ 配对被拒：" + ((e && e.message) || e);
      });
      setTimeout(() => {
        if (!got) out.textContent = "✗ 中继已连上，但配对一直没响应 → projectId 无效 / 项目被暂停 / 该项目开了域名白名单但没登记 " + location.origin + "。请去 dashboard.reown.com 核对 Project ID，并在 Allowed origins 里加上本站域名。";
      }, 15000);
    });

  // WalletConnect projectId：填一次存本机
  if ($("wcPid")) {
    $("wcPid").value = wcProjectId();
    $("wcPid").addEventListener("change", () => {
      localStorage.setItem(WC_PID_KEY, $("wcPid").value.trim());
      toast(t("wc.pidSaved"), "ok");
    });
  }
  // 通用复制（邀请链接等）
  document.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast(t("t.copyLink"), "ok");
      } catch {
        toast(t("t.copyLinkFail"), "err");
      }
    })
  );

  // 换合约地址：先用该地址自己的缓存，再重新读链
  $("contract").addEventListener("change", () => {
    const c = loadHeroCache($("contract").value.trim());
    heroReady = !!c;
    if (c) heroVals = c;
    paintHero();
    loadInfo().catch(() => {
      heroReady = true;
      paintHero();
    });
  });

  if ($("checkBtn")) $("checkBtn").addEventListener("click", check);
  $("genBtn").addEventListener("click", generate);
  $("copyBtn").addEventListener("click", copyCmd);
  $("mintBtn").addEventListener("click", mintWithWallet);
  if ($("wpCopy")) $("wpCopy").addEventListener("click", async () => {
    const linkEl = $("wpLink");
    if (!linkEl) return;
    try { await navigator.clipboard.writeText(linkEl.value); toast(t("t.copyLink"), "ok"); }
    catch { toast(t("t.copyLinkFail"), "err"); }
  });

  // 合约地址支持 URL 参数 ?contract=0x... 动态指定（覆盖源码默认值，部署新合约免改源码）
  try {
    const _c = new URLSearchParams(location.search).get("contract");
    if (_c && ethers.isAddress(_c)) CONFIG.CONTRACT = ethers.getAddress(_c);
  } catch {}
  // 预填合约 / USDT / NFT 地址（USDT/NFT 随后会被 loadInfo 链上值覆盖）
  if ($("contract")) $("contract").value = CONFIG.CONTRACT;
  if ($("usdt")) $("usdt").value = CONFIG.USDT;
  if ($("nft")) $("nft").value = CONFIG.AGENT_ID_NFT;

  // 先用缓存渲染（刷新时与上次完全一致，不会闪），再静默用链上数据校对
  const cached = loadHeroCache($("contract").value.trim());
  if (cached) {
    heroVals = cached;
    heroReady = true;
  }
  // 自动刷新：每 10 秒刷新全局 mint 进度，若已连钱包则同时刷新「基础+推广」剩余次数
  setInterval(async () => {
    try { await loadInfo(); } catch {}
    if (account && info) { try { await refreshWallet(); } catch {} }
  }, 10000);
  applyLang(LANG);
  loadInfo().catch(() => {
    // 读不到链上参数时退回默认值，避免一直显示"读取中"
    heroReady = true;
    paintHero();
  });
  // 手机从币安 App 返回后自动恢复登录态（即使标签页被重载也能连上）
  restoreAgenticSession().catch(() => {});
})();
