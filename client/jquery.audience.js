(function($, global)
{

    function openXHRConnection(url, deferred)
    {
      var es = new EventSource(url);
      es.addEventListener('message', function(e){
        console.log('message', e)
        var json = JSON.parse(e.data);
        console.log(json);
        deferred.notify(json);
      });
      es.addEventListener('error', function(e){
        console.log(e);
      });

      /*
      function retry(){
        setTimeout(function(){
          openXHRConnection(url, deferred);
        }, 2000);
      }
      ('error abort load'.split(' ')).forEach(function(e){
        es.addEventListener(e, function(e){
          // retry();
        });
      });
      */
    }

    function openFlashConnection(url, deferred)
    {
        var flashObject = null,
            callback = 'audience' + new Date().getTime();

        global[callback] = function(data)
        {
            deferred.notify(data);
        };

        if (navigator.plugins && navigator.mimeTypes && navigator.mimeTypes.length) // Netscape plugin architecture
        {
            flashObject = $('<embed>').attr
            ({
                type: 'application/x-shockwave-flash',
                src: '/client/audience.swf', // TODO make this customizable
                allowScriptAccess: 'always',
                flashvars: 'callback=' + callback + '&url=' + encodeURI(url),
                width: '0',
                height: '0'
            });
        }
        else // IE
        {
            flashObject =
            $(
                '<object id="iframe-embed" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="0" height="0">' +
                    '<param name="movie" value="/client/audience.swf"></param>' + // TODO make this customizable
                    '<param name="flashvars" value="callback=' + callback + '&url=' + encodeURI(url) + '"></param>' +
                    '<param name="allowScriptAccess" value="always"></param>' +
                '</object>'
            );
        }

        flashObject.appendTo(document.body);

        deferred.done(function()
        {
            flashObject.remove();
        });
    }

    $.audience = function(url)
    {
        var deferred = $.Deferred();
        if ($.support.cors)
        {
            // setTimeout to schedule the connection in the next tick in order prevent infinit loading
            setTimeout(function() {openXHRConnection(url, deferred);}, 0);
        }
        else
        {
            openFlashConnection(url, deferred);
        }
        var promise = deferred.promise();
        promise.close = function()
        {
            deferred.resolve();
        };
        return promise;
    };

})(jQuery, this);
