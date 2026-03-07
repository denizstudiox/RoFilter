document.addEventListener('DOMContentLoaded', () => {
    const thresholdInput = document.getElementById('threshold');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const removeSponsoredInput = document.getElementById('removeSponsored');

    // Uygulama açıldığında kaydedilmiş değeri yükle
    chrome.storage.sync.get(['minRatingThreshold', 'removeSponsored'], (data) => {
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
    });

    saveBtn.addEventListener('click', () => {
        const val = parseInt(thresholdInput.value, 10);
        const removeSponsoredVal = removeSponsoredInput.checked;

        // Yanlış veya boş değer girildiğinde hata ver
        if (isNaN(val) || val < 0 || val > 100) {
            statusDiv.textContent = "Please enter a valid percentage (0-100).";
            statusDiv.className = 'error';
            return;
        }

        // Değeri Chrome'un yerel verisine kaydet
        chrome.storage.sync.set({ minRatingThreshold: val, removeSponsored: removeSponsoredVal }, () => {
            statusDiv.innerHTML = "Saved!<br><span style='font-size:12px;color:#ffcc00;'>Please refresh the page to apply.</span>";
            statusDiv.className = 'success';

            // Eğer o anda bir Roblox sayfası açıksa, hemen sayfada filtreyi çalıştır ve yenile
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url && tabs[0].url.includes("roblox.com")) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateSettings",
                        threshold: val,
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
