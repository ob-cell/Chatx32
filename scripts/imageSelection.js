window.onload = function() {
    document.body.onselectstart = function() {
        return false;
    }
}