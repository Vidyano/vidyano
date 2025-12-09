using System.Security.Cryptography;
using Vidyano.Service;

namespace Dev.Service;

public class DevWeb : CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        // Generate a cryptographically secure nonce for this request
        var nonceBytes = RandomNumberGenerator.GetBytes(16);
        var nonce = Convert.ToBase64String(nonceBytes);

        // Inject nonce into all script tags
        args.Contents = args.Contents.Replace("<script ", $"<script nonce=\"{nonce}\" ");

        // Add Content-Security-Policy header with nonce
        // Only scripts with matching nonce are allowed - no trust propagation via strict-dynamic
        args.ResponseHeaders.ContentSecurityPolicy =
            $"default-src 'self'; " +
            $"script-src 'nonce-{nonce}'; " +
            $"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com http://fonts.googleapis.com; " +
            $"img-src 'self' data:; " +
            $"font-src 'self' https://fonts.gstatic.com http://fonts.gstatic.com; " +
            $"connect-src 'self' https://icons.vidyano.com; " +
            $"frame-ancestors 'self';";
    }
}