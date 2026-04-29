/**
 * Article Actions - Social Sharing & Reading Time
 */

function getShareData() {
    return {
        title: document.title,
        text: document.querySelector('meta[name="description"]')?.content || '',
        url: window.location.href
    };
}

function shareNative() {
    if (navigator.share) {
        navigator.share(getShareData()).catch(() => {});
    }
}

function copyLink() {
    const url = window.location.href;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(url).then(() => {
            showCopyToast('Link copied to clipboard!');
        }).catch(() => {
            fallbackCopyToClipboard(url);
        });
    } else {
        fallbackCopyToClipboard(url);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showCopyToast('Link copied to clipboard!');
    } catch (err) {
        showCopyToast('Could not copy link');
    }
    document.body.removeChild(textArea);
}

function showCopyToast(message) {
    let toast = document.querySelector('.copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'copy-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

function shareEmail() {
    const data = getShareData();
    const subject = encodeURIComponent(data.title);
    const body = encodeURIComponent(data.text + '\n\nRead more: ' + data.url);
    window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
}

function shareTwitter() {
    const data = getShareData();
    const text = encodeURIComponent(data.title);
    const url = encodeURIComponent(data.url);
    window.open(
        'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
        '_blank', 'width=600,height=400,menubar=no,toolbar=no'
    );
}

function shareFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(
        'https://www.facebook.com/sharer/sharer.php?u=' + url,
        '_blank', 'width=600,height=400,menubar=no,toolbar=no'
    );
}

function shareLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(
        'https://www.linkedin.com/sharing/share-offsite/?url=' + url,
        '_blank', 'width=600,height=400,menubar=no,toolbar=no'
    );
}

function shareReddit() {
    const data = getShareData();
    const title = encodeURIComponent(data.title);
    const url = encodeURIComponent(data.url);
    window.open(
        'https://www.reddit.com/submit?url=' + url + '&title=' + title,
        '_blank', 'width=600,height=600,menubar=no,toolbar=no'
    );
}

// Reading Time Calculation
(function() {
    const readingTimeEl = document.getElementById('readingTimeText');
    if (!readingTimeEl) return;

    const articleContent = document.querySelector('.article-content') ||
                          document.querySelector('.content-wrapper') ||
                          document.querySelector('main');
    if (!articleContent) {
        readingTimeEl.textContent = '1 min read';
        return;
    }

    const text = articleContent.textContent || articleContent.innerText || '';
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const minutes = Math.ceil(words / 200);
    readingTimeEl.textContent = minutes === 1 ? '1 min read' : minutes + ' min read';
})();
