document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const thresholdInput = document.getElementById('threshold');
    const minPlayersInput = document.getElementById('minPlayers');
    const bannedWordsInput = document.getElementById('bannedWords');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const removeSponsoredInput = document.getElementById('removeSponsored');

    chrome.storage.sync.get(['minRatingThreshold', 'removeSponsored', 'minPlayersThreshold', 'bannedWordsStr'], (data) => {
        thresholdInput.value = data.minRatingThreshold ?? 60;
        removeSponsoredInput.checked = data.removeSponsored ?? false;
        minPlayersInput.value = data.minPlayersThreshold || '';
        bannedWordsInput.value = data.bannedWordsStr ?? '';
    });

    settingsForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const val = parseInt(thresholdInput.value, 10);
        let playersVal = parseInt(minPlayersInput.value, 10);
        if (isNaN(playersVal) || playersVal < 0) playersVal = 0;

        const bannedWordsVal = bannedWordsInput.value
            .split(',')
            .map(word => word.trim())
            .filter(Boolean)
            .join(', ');
        const removeSponsoredVal = removeSponsoredInput.checked;

        if (isNaN(val) || val < 0 || val > 100) {
            statusDiv.textContent = "Please enter a valid percentage (0-100).";
            statusDiv.className = 'error';
            thresholdInput.focus();
            return;
        }

        saveBtn.disabled = true;

        chrome.storage.sync.set({ 
            minRatingThreshold: val, 
            removeSponsored: removeSponsoredVal,
            minPlayersThreshold: playersVal,
            bannedWordsStr: bannedWordsVal
        }, () => {
            saveBtn.disabled = false;

            if (chrome.runtime.lastError) {
                statusDiv.textContent = 'Could not save settings. Please try again.';
                statusDiv.className = 'error';
                return;
            }

            statusDiv.textContent = 'Saved. Your active Roblox tab was updated.';
            statusDiv.className = 'success';

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateSettings",
                        threshold: val,
                        minPlayers: playersVal,
                        bannedWords: bannedWordsVal,
                        removeSponsored: removeSponsoredVal,
                        reloadPage: false
                    }, () => {
                        if (chrome.runtime.lastError) {
                            statusDiv.textContent = 'Saved. Open or refresh a Roblox page to apply.';
                        }
                    });
                }
            });

            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = '';
            }, 4000);
        });
    });
});
