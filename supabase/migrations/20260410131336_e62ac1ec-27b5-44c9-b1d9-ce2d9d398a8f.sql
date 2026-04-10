
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'coordinator', 'viewer');

-- Invitation status enum
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);

-- Custom functions table
CREATE TABLE public.custom_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Function permissions matrix
CREATE TABLE public.function_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_id UUID REFERENCES public.custom_functions(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (function_id, module)
);

-- User custom function assignment (one per user)
CREATE TABLE public.user_custom_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  function_id UUID REFERENCES public.custom_functions(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '72 hours'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin or coordinator
CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'coordinator')
  )
$$;

-- Profiles policies
CREATE POLICY "Anyone authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Authenticated can view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Custom functions policies
CREATE POLICY "Authenticated can view custom functions"
  ON public.custom_functions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Coordinator can create custom functions"
  ON public.custom_functions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can update custom functions"
  ON public.custom_functions FOR UPDATE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can delete custom functions"
  ON public.custom_functions FOR DELETE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Function permissions policies
CREATE POLICY "Authenticated can view permissions"
  ON public.function_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Coordinator can manage permissions"
  ON public.function_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can update permissions"
  ON public.function_permissions FOR UPDATE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can delete permissions"
  ON public.function_permissions FOR DELETE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

-- User custom functions policies
CREATE POLICY "Authenticated can view assignments"
  ON public.user_custom_functions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Coordinator can assign functions"
  ON public.user_custom_functions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can update assignments"
  ON public.user_custom_functions FOR UPDATE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can delete assignments"
  ON public.user_custom_functions FOR DELETE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Invitations policies
CREATE POLICY "Admin/Coordinator can view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can create invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin/Coordinator can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Allow anonymous to read invitations by token (for registration flow)
CREATE POLICY "Anyone can read invitation by token"
  ON public.invitations FOR SELECT TO anon
  USING (true);

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Activity log policies
CREATE POLICY "Admins can view all activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Default role: viewer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_functions_updated_at
  BEFORE UPDATE ON public.custom_functions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
