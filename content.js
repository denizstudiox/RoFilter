let currentThreshold = 0;
let currentMinPlayers = 0;
let currentBannedWords = [];
let currentRemoveSponsored = false;

// Metin içerisinden yüzdelik sayıyı çeker
function getPercentage(text) {
    const match = text.match(/(\d+)%/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

// Oyuncu sayısını (Örn: 28.1K, 1.5M, 500) sayısal değere çevirir
function parsePlayerCount(text) {
    if (!text) return 0;

    const normalized = text.trim().toUpperCase().replace(',', '.');
    const match = normalized.match(/([\d.]+)\s*([KMB])?/);
    if (!match) return 0;

    const count = parseFloat(match[1]);
    const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
    return Number.isFinite(count) ? Math.floor(count * (multipliers[match[2]] || 1)) : 0;
}

function setTileVisibility(tile, shouldHide) {
    if (shouldHide) {
        if (tile.dataset.rofilterHidden !== 'true') {
            tile.dataset.rofilterOriginalDisplay = tile.style.display || '';
        }
        tile.dataset.rofilterHidden = 'true';
        tile.style.setProperty('display', 'none', 'important');
        return;
    }

    if (tile.dataset.rofilterHidden === 'true') {
        const originalDisplay = tile.dataset.rofilterOriginalDisplay || '';
        if (originalDisplay) tile.style.setProperty('display', originalDisplay);
        else tile.style.removeProperty('display');
        delete tile.dataset.rofilterHidden;
        delete tile.dataset.rofilterOriginalDisplay;
    }
}

// Oyunu sayfa içerisinden gizler/gösterir
function filterGames() {
    // Tüm oyun kartlarını seç
    const gameTiles = document.querySelectorAll('li.list-item, .grid-tile, .game-card-container');

    gameTiles.forEach(tile => {
        let shouldHide = false;

        // Sponsorlu oyun kontrolü - Sadece "Sponsored" kelimesi değil sınıfın kendisini veya içeriğini kontrol et
        if (currentRemoveSponsored && !shouldHide) {
            // "Sponsored" etiketine sahip olan geniş kartları veya direkt etiketin kendisini arayalım
            const sponsoredLabel = tile.querySelector('.sponsored-ad-label, [title="Sponsored"], [aria-label="Sponsored"]');
            if (sponsoredLabel) {
                shouldHide = true;
            }
        }

        // Yasaklı kelime kontrolü
        if (currentBannedWords.length > 0 && !shouldHide) {
            const titleElement = tile.querySelector('.game-name-title');
            if (titleElement) {
                const gameTitle = (titleElement.getAttribute('title') || titleElement.textContent || "").toLowerCase();
                for (let word of currentBannedWords) {
                    if (gameTitle.includes(word)) {
                        shouldHide = true;
                        break;
                    }
                }
            }
        }

        if (!shouldHide) {
            // Kartın içinde "vote-percentage-label" sınıfını bul
            const ratingElement = tile.querySelector('.vote-percentage-label');
            if (ratingElement) {
                const ratingText = ratingElement.textContent || '';
                const ratingValue = getPercentage(ratingText);

                if (ratingValue !== null) {
                    // Eğer oyunun yüzdesi filtrenin altındaysa widget'ı gizle
                    if (currentThreshold > 0 && ratingValue < currentThreshold) {
                        shouldHide = true;
                    }
                }
            }
        }

        // Aktif oyuncu sayısı kontrolü
        if (currentMinPlayers > 0 && !shouldHide) {
            const playersElement = tile.querySelector('.playing-counts-label');
            if (playersElement) {
                const playersText = playersElement.getAttribute('title') || playersElement.textContent;
                const playersCount = parsePlayerCount(playersText);

                if (playersCount < currentMinPlayers) {
                    shouldHide = true;
                }
            }
        }

        setTileVisibility(tile, shouldHide);
    });
}

// Başlangıçta kaydedilmiş veriyi al ve sayfayı filtrele
chrome.storage.sync.get(['minRatingThreshold', 'removeSponsored', 'minPlayersThreshold', 'bannedWordsStr'], (data) => {
    if (data.minRatingThreshold !== undefined) {
        currentThreshold = parseInt(data.minRatingThreshold, 10);
    }
    if (data.minPlayersThreshold !== undefined) {
        currentMinPlayers = parseInt(data.minPlayersThreshold, 10);
    }
    if (data.bannedWordsStr) {
        currentBannedWords = data.bannedWordsStr.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    }
    if (data.removeSponsored !== undefined) {
        currentRemoveSponsored = data.removeSponsored;
    }
    filterGames();
});

// Eklenti ikonundan (popup) yeni bir değer girildiğinde anında çalıştırır
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateSettings" || request.action === "updateThreshold") {
        if (request.threshold !== undefined) currentThreshold = request.threshold;
        else if (request.value !== undefined) currentThreshold = request.value; // Geriye dönük uyumluluk

        if (request.minPlayers !== undefined) currentMinPlayers = request.minPlayers;

        if (request.bannedWords !== undefined) {
            currentBannedWords = request.bannedWords.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
        }

        if (request.removeSponsored !== undefined) currentRemoveSponsored = request.removeSponsored;

        filterGames();
        sendResponse({ status: "success" });

        // Eğer reload istenmişse sayfayı yenile
        if (request.reloadPage) {
            window.location.reload();
        }
    }
});

// Roblox sayfalarında kaydırma yapıldığında yeni oyunlar yüklenir. 
// Yeni oyunlar yüklendiğinde otomatik olarak tekrar filtrelemesi için MutationObserver kullanıyoruz
let filterTimeout = null;
const observer = new MutationObserver((mutations) => {
    let shouldFilter = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldFilter = true;
            break;
        }
    }

    if (shouldFilter) {
        if (filterTimeout) clearTimeout(filterTimeout);
        // Aşırı işlem yükünden kaçınmak için debouncing (500 ms)
        filterTimeout = setTimeout(() => {
            filterGames();
        }, 500);
    }
});

// Tüm sayfadaki değişimleri izlemeye başla
observer.observe(document.body, { childList: true, subtree: true });
