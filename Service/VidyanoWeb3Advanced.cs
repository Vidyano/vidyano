using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;
using VidyanoWeb3.Service.Model;
using Vidyano.Service;

namespace VidyanoWeb3.Service
{
    public partial class VidyanoWeb3Advanced: Advanced
    {
        public override PersistentObject OnLogin(LoginArgs args)
        {
            args.HasSensitive = true;

            return base.OnLogin(args);
        }

        public override bool IsValidImage(byte[] image)
        {
            return true;
        }
    }
}