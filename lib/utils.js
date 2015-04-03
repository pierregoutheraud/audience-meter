exports.merge = function()
{
    var result = {};

    Array.prototype.forEach.call(arguments, function(obj)
    {
        for (var name in obj)
        {
            if (obj.hasOwnProperty(name))
            {
                result[name] = obj[name];
            }
        }
    });

    return result;
};

function log(severity, message)
{
    if (severity == 'error')
    {
        console.error('[%s] [%s] %s', cluster.isMaster ? 'master' : 'child#' + process.pid, severity, message);
    }
    else if (options.debug)
    {
        console.log('[%s] [%s] %s', cluster.isMaster ? 'master' : 'child#' + process.pid, severity, message);
    }
}

module.exports.log = log;
