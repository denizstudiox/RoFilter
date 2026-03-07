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

    text = text.trim().toUpperCase();
    let multiplier = 1;

    if (text.endsWith('K')) {
        multiplier = 1000;
        text = text.slice(0, -1);
    } else if (text.endsWith('M')) {
        multiplier = 1000000;
        text = text.slice(0, -1);
    } else if (text.endsWith('B')) {
        multiplier = 1000000000;
        text = text.slice(0, -1);
    }

    const count = parseFloat(text);
    if (isNaN(count)) return 0;

    return Math.floor(count * multiplier);
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
            if (sponsoredLabel && (sponsoredLabel.textContent.includes('Sponsored') || sponsoredLabel.textContent.includes('Sponsorlu') || true)) {
                // Eğer etiket bulunduysa içeriğine bakmaksızın gizle (garanti)
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
                const ratingText = ratingElement.getContext || ratingElement.textContent;
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

        if (shouldHide) {
            tile.style.display = 'none';
            tile.classList.add('roblox-filter-hidden');
        } else {
            tile.style.display = ''; // Eşit veya büyükse göster
            tile.classList.remove('roblox-filter-hidden');
        }
    });

    // Filtreleme sonrasında ekranda çok az oyun kalırsa takılmayı önlemek için sayfanın altına doğru kaydırma veya yükleme tetikle
    forceLoadMoreGames();
}

// Bazen çok fazla oyun silindiği için sayfa kaydırılamaz hale geliyor ve Roblox yeni oyun yüklemiyor.
// Bunu çözmek için kaydırma çubuğu kaybolduysa veya çok az oyun kaldıysa aşağı kaydırma tetikliyoruz.
function forceLoadMoreGames() {
    // Görünür olan oyun kutularını bul
    const visibleTiles = document.querySelectorAll('li.list-item:not(.roblox-filter-hidden)');

    // Eğer sayfadaki toplam görünür oyun sayısı azsa veya sayfa kaydırma gerektirmeyecek kadar kısaysa
    if (visibleTiles.length > 0 && visibleTiles.length < 12) {
        // Roblox'un yeni oyunları yüklemesi için sayfanın altına kaydırma simülasyonu yapıyoruz
        window.scrollBy(0, 10);
        setTimeout(() => window.scrollBy(0, -10), 50);

        // Veya scroll eventini manuel olarak ateşleyelim
        window.dispatchEvent(new Event('scroll'));
    }
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
