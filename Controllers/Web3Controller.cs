using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace VidyanoWeb3.Controllers
{
    [Route("web3/{**id}")]
    [ApiController]
    public class Web3Controller : ControllerBase
    {
        [HttpGet]
        public IActionResult Get(string id)
        {
            var provider = new FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(id, out var mimeType))
            {
                switch (Path.GetExtension(id))
                {
                    case ".mjs":
                        mimeType = "application/javascript";
                        break;

                    default:
                        mimeType = "application/octet-stream";
                        break;
                }
            }

            var filePath = Path.Combine(Vulcanizer.RootPath, id);
            if (!System.IO.File.Exists(filePath))
                return NotFound();

            // TODO: Verify if file is allow to be served
            return Content(Vulcanizer.Generate(filePath), mimeType);
        }
    }
}