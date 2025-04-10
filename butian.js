// ==UserScript==
// @name         Butian漏洞提交助手
// @namespace    http://github.com/Yn8rt
// @version      1.5
// @description  带可移动面板、全屏切换、自动填充开关和新增漏洞标题、漏洞描述、修复建议配置项的提交助手
// @author       Yn8rt
// @match        *://*.butian.net/Loo/submit*
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'ButianHelperConfig';
    const PANEL_STATE_KEY = 'PanelState';
    const DEFAULT_CONFIG = {
        companyName: "示例厂商",
        vulURL: "http://example.com",
        rootDomain: "example.com",
        vulTitle: "示例厂商管理后台存在弱口令",
        vulDescription: "示例厂商管理后台存在弱口令",
        repairSuggest: "修改弱口令！！！！！！"
    };

    class PanelController {
        constructor() {
            this.panel = null;
            this.isDragging = false;
            this.startX = 0;
            this.startY = 0;
            this.startLeft = 0;
            this.startTop = 0;
        }

        createPanel() {
            this.panel = document.createElement('div');
            this.panel.id = 'config-panel';
            this._addStyles();

            this.panel.innerHTML = `
                <div class="title-bar">
                    <span>配置面板</span>
                    <div class="controls">
                        <button class="min-btn">−</button>
                        <button class="fs-btn">全屏</button>
                        <button class="auto-switch">
                            <span class="switch-label">自动填充</span>
                            <span class="switch"></span>
                        </button>
                    </div>
                </div>
                <div class="panel-content">
                    <h3 style="margin-top:0;">配置参数</h3>
                    <div class="config-item">
                        <label>厂商名称</label>
                        <input type="text" class="config-input" id="companyName">
                    </div>
                    <div class="config-item">
                        <label>漏洞URL</label>
                        <input type="text" class="config-input" id="vulURL">
                    </div>
                    <div class="config-item">
                        <label>主域名</label>
                        <input type="text" class="config-input" id="rootDomain">
                    </div>
                    <div class="config-item">
                        <label>漏洞标题</label>
                        <input type="text" class="config-input" id="vulTitle">
                    </div>
                    <div class="config-item">
                        <label>漏洞描述</label>
                        <textarea class="config-input" id="vulDescription"></textarea>
                    </div>
                    <div class="config-item">
                        <label>修复建议</label>
                        <textarea class="config-input" id="repairSuggest"></textarea>
                    </div>
                    <button id="save-btn">保存并应用配置</button>
                </div>
            `;

            document.body.appendChild(this.panel);
            this._initDrag();
            this._initMinimize();
            this._initFullScreen();
            this._initAutoSwitch();
            this._loadPanelState();
            return this.panel;
        }

        _addStyles() {
            GM_addStyle(`
                #config-panel {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    width: 400px; /* 固定宽度 */
                    max-height: 90vh;
                    overflow: auto;
                    resize: none; /* 禁止调整大小 */
                }
                #config-panel.fullscreen {
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    right: auto !important;
                }
                .title-bar {
                    background: #007bff;
                    color: white;
                    padding: 8px;
                    cursor: move;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 5px 5px 0 0;
                }
                .controls {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .min-btn, .fs-btn {
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0 5px;
                    line-height: 1;
                }
                .auto-switch {
                    background: none;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    color: white;
                    cursor: pointer;
                    padding: 2px;
                }
                .switch {
                    width: 40px;
                    height: 20px;
                    background: #ccc;
                    border-radius: 10px;
                    position: relative;
                    transition: 0.3s;
                }
                .switch::before {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: white;
                    top: 2px;
                    left: 2px;
                    transition: 0.3s;
                }
                .switch.active {
                    background: #28a745;
                }
                .switch.active::before {
                    left: 22px;
                }
                .panel-content {
                    padding: 15px;
                    transition: 0.3s;
                }
                .minimized .panel-content {
                    display: none;
                }
                .config-item {
                    margin: 10px 0;
                }
                .config-item label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                .config-input {
                    width: 100%;
                    padding: 6px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    box-sizing: border-box;
                }
                textarea.config-input {
                    resize: vertical; /* 允许垂直调整高度 */
                }
                #save-btn {
                    width: 100%;
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-top: 10px;
                }
            `);
        }

        _initDrag() {
            const titleBar = this.panel.querySelector('.title-bar');
            titleBar.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return;
                this.isDragging = true;
                this.startX = e.clientX;
                this.startY = e.clientY;
                const rect = this.panel.getBoundingClientRect();
                this.startLeft = rect.left;
                this.startTop = rect.top;
                this.panel.style.position = 'fixed';
            });

            document.addEventListener('mousemove', (e) => {
                if (!this.isDragging) return;
                const dx = e.clientX - this.startX;
                const dy = e.clientY - this.startY;
                this.panel.style.left = `${this.startLeft + dx}px`;
                this.panel.style.top = `${this.startTop + dy}px`;
            });

            document.addEventListener('mouseup', () => {
                if (!this.isDragging) return;
                this.isDragging = false;
                this._savePanelState();
            });
        }

        _initMinimize() {
            this.panel.querySelector('.min-btn').addEventListener('click', () => {
                this.panel.classList.toggle('minimized');
                this._savePanelState();
            });
        }

        _initFullScreen() {
            const fsBtn = this.panel.querySelector('.fs-btn');
            fsBtn.addEventListener('click', () => {
                this.panel.classList.toggle('fullscreen');
                fsBtn.textContent = this.panel.classList.contains('fullscreen') ? '退出全屏' : '全屏';
                this._savePanelState();
            });
        }

        _initAutoSwitch() {
            const switchEl = this.panel.querySelector('.switch');
            switchEl.addEventListener('click', () => {
                switchEl.classList.toggle('active');
                this._savePanelState();
            });
        }

        get autoFillEnabled() {
            return this.panel.querySelector('.switch').classList.contains('active');
        }

        _savePanelState() {
            GM_setValue(PANEL_STATE_KEY, {
                left: this.panel.style.left,
                top: this.panel.style.top,
                minimized: this.panel.classList.contains('minimized'),
                autoFill: this.autoFillEnabled,
                fullscreen: this.panel.classList.contains('fullscreen')
            });
        }

        _loadPanelState() {
            const state = GM_getValue(PANEL_STATE_KEY);
            if (state) {
                this.panel.style.left = state.left || 'auto';
                this.panel.style.top = state.top || '20px';
                if (state.minimized) this.panel.classList.add('minimized');
                this.panel.querySelector('.switch').classList.toggle('active', state.autoFill);
                if (state.fullscreen) {
                    this.panel.classList.add('fullscreen');
                    this.panel.querySelector('.fs-btn').textContent = '退出全屏';
                }
            }
        }
    }

    // 读取和保存配置
    function loadConfig() {
        const saved = GM_getValue(STORAGE_KEY);
        return saved ? {...DEFAULT_CONFIG, ...saved} : DEFAULT_CONFIG;
    }

    function saveConfig(newConfig) {
        GM_setValue(STORAGE_KEY, newConfig);
    }

    // 填充表单数据，使用面板中配置的参数
    function fillForm(config) {
    // 确保配置项存在，避免 undefined 或 null
    const companyName = config.companyName || '';
    const vulTitle = config.vulTitle || '';
    const vulDescription = config.vulDescription || '';
    const repairSuggest = config.repairSuggest || '';

    // 填充表单
    setValue('input[name="company_name"]', companyName);
    setValue('input[name="host"]', config.rootDomain || '');
    setValue('input[name="title"]', `${companyName}${vulTitle}`); // 添加空格分隔
    setValue('input[name="url[]"]', config.vulURL || '');

    // 设置下拉框
    setSelect('select[name="type"]', '67');
    setSelect('select[name="weight"]', '0');
    setSelect('select[name="acitve_id"]', '74');
    setSelect('select[name="mission_id"]', '75');

    // 填充漏洞描述和修复建议
    setValue('textarea[name="description"]', `${companyName}${vulDescription}`); // 添加换行符
    setValue('textarea[name="repair_suggest"]', repairSuggest);

    // 勾选匿名提交
    const checkbox = document.querySelector('input[name="anonymous"]');
    if (checkbox) checkbox.checked = true;
}

    function setValue(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.value = value;
    }

    function setSelect(selector, value) {
        const el = document.querySelector(selector);
        if (el) {
            el.value = value;
            el.dispatchEvent(new Event('change'));
        }
    }

    // 初始化：创建面板、填充当前配置、绑定保存按钮及自动填充逻辑
    function init() {
        const panelController = new PanelController();
        const panel = panelController.createPanel();
        const currentConfig = loadConfig();

        // 填充配置输入框
        panel.querySelector('#companyName').value = currentConfig.companyName;
        panel.querySelector('#vulURL').value = currentConfig.vulURL;
        panel.querySelector('#rootDomain').value = currentConfig.rootDomain;
        panel.querySelector('#vulTitle').value = currentConfig.vulTitle;
        panel.querySelector('#vulDescription').value = currentConfig.vulDescription;
        panel.querySelector('#repairSuggest').value = currentConfig.repairSuggest;

        // 保存按钮事件
        panel.querySelector('#save-btn').addEventListener('click', () => {
            const newConfig = {
                companyName: panel.querySelector('#companyName').value,
                vulURL: panel.querySelector('#vulURL').value,
                rootDomain: panel.querySelector('#rootDomain').value,
                vulTitle: panel.querySelector('#vulTitle').value,
                vulDescription: panel.querySelector('#vulDescription').value,
                repairSuggest: panel.querySelector('#repairSuggest').value
            };
            saveConfig(newConfig);
            fillForm(newConfig);
            alert('配置已保存并应用！');
        });

        // 自动填充逻辑
        window.addEventListener('load', () => {
            if (panelController.autoFillEnabled) {
                setTimeout(() => fillForm(currentConfig), 1500);
            }
        });
    }

    init();
})();
