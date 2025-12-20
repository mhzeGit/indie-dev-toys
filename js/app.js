/**
 * Indie Dev Toys - Main Application
 * Handles navigation and core app functionality with dynamic view loading
 */

const App = {
    currentTool: 'dashboard',
    loadedViews: new Set(),
    viewContainer: null,

    // Tool definitions with their view file and init function
    tools: {
        'dashboard': { view: 'views/dashboard.html', init: null },
        'seamless-texture': { view: 'views/seamless-texture.html', init: () => SeamlessTextureTool.init() },
        'background-remover': { view: 'views/background-remover.html', init: () => BackgroundRemoverTool.init() },
        'texture-dilation': { view: 'views/texture-dilation.html', init: () => TextureDilationTool.init() },
        'normal-map': { view: 'views/normal-map.html', init: () => NormalMapTool.init() },
        'channel-packer': { view: 'views/channel-packer.html', init: () => ChannelPacker.init() },
        'atlas-packer': { view: 'views/atlas-packer.html', init: () => AtlasPacker.init() },
        'sprite-extractor': { view: 'views/sprite-extractor.html', init: () => SpriteExtractor.init() }
    },

    /**
     * Initialize the application
     */
    async init() {
        this.viewContainer = document.getElementById('view-container');
        this.setupNavigation();
        this.setupKeyboardShortcuts();
        
        // Load dashboard first
        await this.loadView('dashboard');
        this.setupDashboardCards();
        
        // Check for URL hash navigation
        await this.handleHashNavigation();
        window.addEventListener('hashchange', () => this.handleHashNavigation());
        
        console.log('Indie Dev Toys initialized');
    },

    /**
     * Load a view HTML file dynamically
     */
    async loadView(toolName) {
        if (this.loadedViews.has(toolName)) {
            return true;
        }

        const toolConfig = this.tools[toolName];
        if (!toolConfig) {
            console.error(`Unknown tool: ${toolName}`);
            return false;
        }

        try {
            const response = await fetch(toolConfig.view);
            if (!response.ok) {
                throw new Error(`Failed to load view: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // Append the view to the container
            while (temp.firstChild) {
                this.viewContainer.appendChild(temp.firstChild);
            }
            
            this.loadedViews.add(toolName);
            
            // Initialize the tool if it has an init function
            if (toolConfig.init) {
                toolConfig.init();
            }
            
            // Setup dashboard cards if loading dashboard
            if (toolName === 'dashboard') {
                this.setupDashboardCards();
            }
            
            return true;
        } catch (error) {
            console.error(`Error loading view ${toolName}:`, error);
            return false;
        }
    },

    /**
     * Setup sidebar navigation
     */
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tool = item.dataset.tool;
                this.navigateTo(tool);
            });
        });
    },

    /**
     * Setup dashboard tool cards
     */
    setupDashboardCards() {
        document.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.dataset.tool;
                this.navigateTo(tool);
            });
        });
    },

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape to go back to dashboard
            if (e.key === 'Escape' && this.currentTool !== 'dashboard') {
                this.navigateTo('dashboard');
            }
            
            // Number keys for quick tool access
            if (e.altKey) {
                const toolKeys = {
                    '1': 'seamless-texture',
                    '2': 'background-remover',
                    '3': 'texture-dilation',
                    '4': 'normal-map',
                    '5': 'channel-packer',
                    '6': 'atlas-packer',
                    '7': 'sprite-extractor',
                    '0': 'dashboard'
                };
                
                if (toolKeys[e.key]) {
                    this.navigateTo(toolKeys[e.key]);
                }
            }
        });
    },

    /**
     * Handle URL hash navigation
     */
    async handleHashNavigation() {
        const hash = window.location.hash.slice(1);
        if (hash && this.tools[hash]) {
            await this.navigateTo(hash);
        }
    },

    /**
     * Navigate to a tool
     */
    async navigateTo(tool) {
        // Load view if not already loaded
        const loaded = await this.loadView(tool);
        if (!loaded) {
            console.error(`Could not navigate to ${tool}`);
            return;
        }
        
        // Update URL hash
        window.location.hash = tool;
        
        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tool === tool);
        });
        
        // Update tool views
        document.querySelectorAll('.tool-view').forEach(view => {
            view.classList.toggle('active', view.id === tool);
        });
        
        this.currentTool = tool;
        
        // Scroll to top
        document.querySelector('.main-content').scrollTop = 0;
    },

    /**
     * Get current tool name
     */
    getCurrentTool() {
        return this.currentTool;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Prevent accidental navigation away when working
window.addEventListener('beforeunload', (e) => {
    // Only warn if there's unsaved work
    const hasWork = (typeof SeamlessTextureTool !== 'undefined' && SeamlessTextureTool.resultImageData) ||
                   (typeof BackgroundRemoverTool !== 'undefined' && BackgroundRemoverTool.resultImageData) ||
                   (typeof TextureDilationTool !== 'undefined' && TextureDilationTool.resultImageData) ||
                   (typeof NormalMapTool !== 'undefined' && NormalMapTool.resultImageData);
    
    if (hasWork) {
        e.preventDefault();
        e.returnValue = '';
    }
});
