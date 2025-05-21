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

namespace Dev.Controllers
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

            // TODO: Verify that served files are permitted

            if (!id.StartsWith("libs/modules/")) {
                var filePath = Path.Combine(Vulcanizer.RootPath, id);
                if (!System.IO.File.Exists(filePath))
                    return NotFound();

                return Content(Vulcanizer.Generate(filePath), mimeType);
            }
                
            var moduleFilePath = Path.Combine(Vulcanizer.RootPath, id.Replace("libs/modules/", "../node_modules/"));
            if (!System.IO.File.Exists(moduleFilePath))
                return NotFound();

            return Content(System.IO.File.ReadAllText(moduleFilePath), mimeType);
        }
    }
}