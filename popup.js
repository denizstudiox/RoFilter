document.addEventListener('DOMContentLoaded', () => {
    const thresholdInput = document.getElementById('threshold');
    const minPlayersInput = document.getElementById('minPlayers');
    const bannedWordsInput = document.getElementById('bannedWords');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const removeSponsoredInput = document.getElementById('removeSponsored');

    // Uygulama açıldığında kaydedilmiş değeri yükle
    chrome.storage.sync.get(['minRatingThreshold', 'removeSponsored', 'minPlayersThreshold', 'bannedWordsStr'], (data) => {
        if (data.minRatingThreshold !== undefined) {
            thresholdInput.value = data.minRatingThreshold;
        } else {
            thresholdInput.value = 60; // Varsayılan değer
        }

        if (data.removeSponsored !== undefined) {
            removeSponsoredInput.checked = data.removeSponsored;
        } else {
            removeSponsoredInput.checked = false; // Varsayılan değer
        }

        if (data.minPlayersThreshold !== undefined) {
            minPlayersInput.value = data.minPlayersThreshold;
        } else {
            minPlayersInput.value = "";
        }

        if (data.bannedWordsStr !== undefined) {
            bannedWordsInput.value = data.bannedWordsStr;
        } else {
            bannedWordsInput.value = "";
        }
    });

    saveBtn.addEventListener('click', () => {
        const val = parseInt(thresholdInput.value, 10);
        let playersVal = parseInt(minPlayersInput.value, 10);
        if (isNaN(playersVal) || playersVal < 0) playersVal = 0;

        const bannedWordsVal = bannedWordsInput.value;
        const removeSponsoredVal = removeSponsoredInput.checked;

        // Yanlış veya boş değer girildiğinde hata ver
        if (isNaN(val) || val < 0 || val > 100) {
            statusDiv.textContent = "Please enter a valid percentage (0-100).";
            statusDiv.className = 'error';
            return;
        }

        // Değeri Chrome'un yerel verisine kaydet
        chrome.storage.sync.set({ 
            minRatingThreshold: val, 
            removeSponsored: removeSponsoredVal,
            minPlayersThreshold: playersVal,
            bannedWordsStr: bannedWordsVal
        }, () => {
            statusDiv.innerHTML = "Saved!<br><span style='font-size:12px;color:#ffcc00;'>Please refresh the page to apply.</span>";
            statusDiv.className = 'success';

            // Eğer o anda bir Roblox sayfası açıksa, hemen sayfada filtreyi çalıştır ve yenile
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url && tabs[0].url.includes("roblox.com")) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateSettings",
                        threshold: val,
                        minPlayers: playersVal,
                        bannedWords: bannedWordsVal,
                        removeSponsored: removeSponsoredVal,
                        reloadPage: false
                    });
                }
            });

            // Mesajı bir süre sonra temizle
            setTimeout(() => {
                statusDiv.innerHTML = "";
                statusDiv.className = '';
            }, 4000);
        });
    });
});
