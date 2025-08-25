using Vidyano.Service.Repository;
using Vidyano.Service;

namespace Dev.Service
{
    public partial class DevAdvanced: Advanced
    {
        public override PersistentObject OnLogin(LoginArgs args)
        {
            args.HasSensitive = true;

            return base.OnLogin(args)!;
        }
    }
}