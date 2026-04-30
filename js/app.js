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