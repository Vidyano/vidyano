using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.CustomActions
{
    public class Retry : CustomAction<VidyanoWeb3Context>
    {
        /// <inheritdoc />
        public Retry(VidyanoWeb3Context context) : base(context)
        {
        }

        /// <inheritdoc />
        public override PersistentObject Execute(CustomActionArgs e)
        {
            var options = new[] { "Yes, I'm sure", "No, not so sure" };

            if (Manager.Current.RetryResult == null)
                Manager.Current.RetryAction("Are you sure?", "Fill in the form below:", Manager.Current.GetPersistentObject(nameof(Retry), isNew: true, targetContext: Context), options, 0, 1);
            else if (Manager.Current.RetryResult.Option == options[0])
                return Manager.Current.GetNotification("Well done!", NotificationType.OK);
            else if (Manager.Current.RetryResult.Option == options[1])
                return Manager.Current.GetNotification("Not so sure it is.", NotificationType.Warning);

            return null;
        }
    }
}