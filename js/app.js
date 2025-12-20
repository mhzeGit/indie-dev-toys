/**
 * Indie Dev Toys - Main Application
 * Handles navigation and core app functionality
 */

const App = {
    currentTool: 'dashboard',

    /**
     * Initialize the application
     */
    init() {
        this.setupNavigation();
        this.setupDashboardCards();
        this.setupKeyboardShortcuts();
        
        // Check for URL hash navigation
        this.handleHashNavigation();
        window.addEventListener('hashchange', () => this.handleHashNavigation());
        
        console.log('Indie Dev Toys initialized');
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
                switch (e.key) {
                    case '1':
                        this.navigateTo('seamless-texture');
                        break;
                    case '2':
                        this.navigateTo('background-remover');
                        break;
                    case '3':
                        this.navigateTo('texture-dilation');
                        break;
                    case '4':
                        this.navigateTo('normal-map');
                        break;
                    case '0':
                        this.navigateTo('dashboard');
                        break;
                }
            }
        });
    },

    /**
     * Handle URL hash navigation
     */
    handleHashNavigation() {
        const hash = window.location.hash.slice(1);
        if (hash && document.getElementById(hash)) {
            this.navigateTo(hash);
        }
    },

    /**
     * Navigate to a tool
     */
    navigateTo(tool) {
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
    const hasWork = SeamlessTextureTool.resultImageData ||
                   BackgroundRemoverTool.resultImageData ||
                   TextureDilationTool.resultImageData ||
                   NormalMapTool.resultImageData;
    
    if (hasWork) {
        e.preventDefault();
        e.returnValue = '';
    }
});
