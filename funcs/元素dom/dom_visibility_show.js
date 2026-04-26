(function() {
    var keep = document.querySelector('#messages-container');                                                                                                             
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    if (keep) {
      keep.style.width = '100%';
      keep.style.height = '100vh';
      keep.style.overflow = 'auto';
      document.body.appendChild(keep);
    }
  })();


