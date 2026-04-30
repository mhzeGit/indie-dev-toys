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
        'sprite-extractor': { view: 'views/sprite-extractor.html', init: () => SpriteExtractor.init() },
        'texture-library': { view: 'views/texture-library.html', init: () => TextureLibrary.init() },
        'file-converter':  { view: 'views/file-converter.html',  init: () => FileConverter.init() }
    },

    /**
     * Initialize the application
     */
    async init() {
        this.viewContainer = document.getElementById('view-container');
        this.setupNavigation();
        this.setupKeyboardShortcuts();
        
        // Make nav items focusable
        document.querySelectorAll('.nav-item').forEach(item => {
            item.setAttribute('tabindex', '0');
        });
        
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
            
            const activeElement = document.activeElement;
            const navItems = Array.from(document.querySelectorAll('.nav-item'));
            
            // Arrow key navigation for sidebar nav items
            if (navItems.includes(activeElement)) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    const currentIndex = navItems.indexOf(activeElement);
                    let newIndex;
                    if (e.key === 'ArrowDown') {
                        newIndex = (currentIndex + 1) % navItems.length;
                    } else {
                        newIndex = (currentIndex - 1 + navItems.length) % navItems.length;
                    }
                    navItems[newIndex].focus();
                    e.preventDefault();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    // Move focus to the current tool's view panel
                    const activeToolView = document.querySelector('.tool-view.active');
                    if (activeToolView) {
                        // Prefer focusing first focusable element in the sidebar
                        const sidebar = activeToolView.querySelector('.tool-sidebar');
                        if (sidebar) {
                            const focusable = sidebar.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                            if (focusable) {
                                focusable.focus();
                            } else {
                                // Focus the sidebar itself
                                sidebar.setAttribute('tabindex', '-1');
                                sidebar.focus();
                            }
                        } else {
                            // Focus the tool view itself
                            activeToolView.setAttribute('tabindex', '-1');
                            activeToolView.focus();
                        }
                    }
                    e.preventDefault();
                    return;
                }
            }
            
            // Arrow left from tool view back to sidebar nav
            if (e.key === 'ArrowLeft' && activeElement.closest('.tool-view')) {
                // Allow left arrow in inputs/textareas for cursor movement
                if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT' && !activeElement.isContentEditable) {
                    const currentNavItem = document.querySelector(`.nav-item[data-tool="${this.currentTool}"]`);
                    if (currentNavItem) {
                        currentNavItem.focus();
                        e.preventDefault();
                        return;
                    }
                }
            }
            
            // Tool-specific navigation (e.g., within tool sidebar)
            this.handleToolNavigation(e);
            
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
                    '8': 'texture-library',
                    '0': 'dashboard'
                };
                
                const tool = toolKeys[e.key];
                if (tool) {
                    this.navigateTo(tool);
                }
            }
        });
    },

    /**
     * Handle keyboard navigation on dashboard
     */
    handleDashboardNavigation(e) {
        const toolCards = Array.from(document.querySelectorAll('.tool-card'));
        if (toolCards.length === 0) return;

        const currentIndex = toolCards.findIndex(card => 
            document.activeElement === card || 
            document.activeElement === card.querySelector('button') ||
            document.activeElement.closest('.tool-card') === card
        );

        let newIndex = currentIndex;

        // Handle initial state when nothing is focused
        if (currentIndex === -1 && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'Enter')) {
            // Start from first item for ArrowDown/Enter, last item for ArrowUp
            if (e.key === 'ArrowUp') {
                newIndex = toolCards.length - 1; // Go to last item
            } else { // ArrowDown, ArrowRight, Enter
                newIndex = 0; // Go to first item
            }
            e.preventDefault();
        } 
        // Handle normal navigation
        else if (e.key === 'ArrowDown') {
            newIndex = (currentIndex + 1) % toolCards.length;
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            newIndex = (currentIndex - 1 + toolCards.length) % toolCards.length;
            e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            if (currentIndex >= 0) {
                const tool = toolCards[currentIndex].dataset.tool;
                this.navigateTo(tool);
                e.preventDefault();
            }
        }

        if (newIndex !== currentIndex && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            toolCards[newIndex].focus();
            e.preventDefault();
        }
    },

    /**
     * Handle keyboard navigation within tools
     */
    handleToolNavigation(e) {
        // Focus on tool panel with ArrowRight when in preview area
        if (e.key === 'ArrowRight' && 
            (document.activeElement.closest('#seamless-preview') ||
             document.activeElement.closest('#extractor-preview') ||
             document.activeElement.closest('#packer-preview') ||
             document.activeElement.closest('#normal-preview') ||
             document.activeElement.closest('#bgremove-preview') ||
             document.activeElement.closest('#dilation-preview') ||
             document.activeElement.closest('#atlas-preview') ||
             document.activeElement.closest('#texlib-preview'))) {
            
            // Find the first focusable element in the sidebar
            const sidebar = document.querySelector('.tool-sidebar');
            if (sidebar) {
                const focusable = sidebar.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusable) {
                    focusable.focus();
                    e.preventDefault();
                }
            }
        }

        // Arrow key navigation within tool panels
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const focusedElement = document.activeElement;
            const toolSidebar = document.querySelector('.tool-sidebar');
            
            if (toolSidebar && toolSidebar.contains(focusedElement)) {
                const focusableElements = Array.from(toolSidebar.querySelectorAll(
                    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                ));
                
                if (focusableElements.length === 0) return;

                const currentIndex = focusableElements.indexOf(focusedElement);
                let newIndex = currentIndex;

                if (e.key === 'ArrowDown') {
                    newIndex = (currentIndex + 1) % focusableElements.length;
                } else if (e.key === 'ArrowUp') {
                    newIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
                }

                if (newIndex !== currentIndex) {
                    focusableElements[newIndex].focus();
                    e.preventDefault();
                }
            }
        }

        // Handle Enter key for buttons and form submission
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            
            // Trigger button clicks
            if (activeElement.tagName === 'BUTTON' || 
                activeElement.classList.contains('btn') ||
                activeElement.closest('.btn')) {
                activeElement.click();
                e.preventDefault();
            }
            
            // Handle range inputs and sliders
            if (activeElement.type === 'range' || activeElement.type === 'number') {
                // For range inputs, we'll update on change already handled by real-time updates
                // For number inputs, we can blur to trigger change
                activeElement.blur();
                e.preventDefault();
            }
        }
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
        
        // Set initial focus for dashboard
        if (tool === 'dashboard') {
            // Focus first tool card after a brief delay to ensure DOM is ready
            setTimeout(() => {
                const firstToolCard = document.querySelector('.tool-card[data-tool]');
                if (firstToolCard) {
                    firstToolCard.focus();
                }
            }, 100);
        }
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
