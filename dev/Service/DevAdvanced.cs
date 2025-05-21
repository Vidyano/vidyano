using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;
using Dev.Service.Model;
using Vidyano.Service;

namespace Dev.Service
{
    public partial class DevAdvanced: Advanced
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