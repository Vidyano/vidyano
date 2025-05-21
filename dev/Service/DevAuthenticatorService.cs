using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;
using Dev.Service.Model;
using Vidyano.Service;

namespace Dev.Service
{
    public partial class DevAuthenticatorService: AuthenticatorService
    {
        public override bool CheckUserCredentials(UserCredentials credentials)
        {
            return true; // base.CheckUserCredentials(credentials);
        }
    }
}